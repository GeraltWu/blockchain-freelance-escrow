import {
  ActionIcon,
  Button,
  Card,
  Center,
  Divider,
  Group,
  NumberInput,
  Stack,
  Stepper,
  Text,
  Textarea,
  TextInput,
  ThemeIcon,
  Title,
  Tooltip,
} from '@mantine/core'
import { DatePickerInput } from '@mantine/dates'
import { useForm } from '@mantine/form'
import { notifications } from '@mantine/notifications'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { IconCircleCheck, IconPlus, IconTrash, IconWallet } from '@tabler/icons-react'
import dayjs from 'dayjs'
import { parseEther } from 'ethers'
import { createEscrowMetadata } from '../api/escrows.js'
import { AddressText } from '../components/AddressText.jsx'
import { Mono } from '../components/Mono.jsx'
import { useWallet } from '../hooks/useWallet.js'
import { formatEth } from '../utils/format.js'
import { isEthAddress } from '../utils/validators.js'
import { createEscrowOnChain } from '../web3/contract.js'

// Page 2:Create Escrow(见 docs/ui-design.md 四)
// 三步 Stepper:基本信息 → Milestone 设置 → 确认信息
// 金额校验规则:正数、最多 6 位小数;总金额实时求和

const MAX_AMOUNT_DECIMALS = 6
const AMOUNT_RE = /^\d+(\.\d{1,6})?$/

function isPositiveAmount(value) {
  return typeof value === 'string' && AMOUNT_RE.test(value) && Number(value) > 0
}

export function CreateEscrow() {
  const { address, signer } = useWallet()
  const [active, setActive] = useState(0) // 0..2 = 三步;3 = 完成态(Stepper.Completed)
  const [creating, setCreating] = useState(false)
  const [createdId, setCreatedId] = useState(null)

  const form = useForm({
    initialValues: {
      freelancerAddress: '',
      title: '',
      description: '',
      deadline: null,
      milestones: [{ description: '', amountEth: '' }],
    },
    validateInputOnBlur: true, // 地址失焦时校验(见 ui-design.md 四.1)
    validate: {
      freelancerAddress: (v) => {
        if (!isEthAddress(v)) return 'Invalid Ethereum address (0x + 40 hex chars)'
        if (address && v.toLowerCase() === address.toLowerCase()) {
          return 'Cannot create an escrow with yourself as freelancer'
        }
        return null
      },
      title: (v) => {
        if (!v.trim()) return 'Title is required'
        if (v.trim().length > 120) return 'Max 120 characters'
        return null
      },
      deadline: (v) => {
        if (!v) return 'Deadline is required'
        // DatePickerInput 的值是字符串(valueFormat),统一用 dayjs 比较
        if (dayjs(v).isBefore(dayjs(), 'day')) return 'Deadline must be in the future'
        return null
      },
      milestones: {
        description: (v) => (v.trim() ? null : 'Required'),
        amountEth: (v) => {
          if (v === '' || v == null) return 'Required'
          if (!isPositiveAmount(String(v))) {
            return `Must be > 0, max ${MAX_AMOUNT_DECIMALS} decimals`
          }
          return null
        },
      },
    },
  })

  // 实时 Total(wei 求和,不做浮点运算)
  const totalWei = form.values.milestones.reduce((sum, m) => {
    if (!isPositiveAmount(String(m.amountEth || ''))) return sum
    try {
      return sum + parseEther(String(m.amountEth))
    } catch {
      return sum
    }
  }, 0n)

  const addMilestone = () => form.insertListItem('milestones', { description: '', amountEth: '' })

  const removeMilestone = (index) => {
    if (form.values.milestones.length > 1) form.removeListItem('milestones', index)
  }

  const nextStep = () => {
    if (active === 0) {
      const invalid = ['freelancerAddress', 'title', 'deadline'].some(
        (f) => form.validateField(f)[f] != null,
      )
      if (invalid) return
    } else if (active === 1) {
      const invalid = form.values.milestones.some((_, i) =>
        ['description', 'amountEth'].some(
          (k) => form.validateField(`milestones.${i}.${k}`)[`milestones.${i}.${k}`] != null,
        ),
      )
      if (invalid) return
    }
    setActive((c) => c + 1)
  }

  // 创建流程(ui-design.md 四.3 + 七):
  // 链上 createEscrow → EscrowCreated 事件拿 escrowId → POST /api/escrows 存元数据
  // 三段式通知;成功后原设计还要弹 fund 确认 Modal(等合约接入后补上)
  const handleCreate = async () => {
    if (!address || !signer) return
    const { freelancerAddress, title, description, deadline, milestones } = form.values

    setCreating(true)
    notifications.show({
      id: 'create-flow',
      title: 'Waiting for wallet confirmation…',
      message: 'Confirm the transaction in MetaMask.',
      color: 'blue',
      loading: true,
      autoClose: false,
    })

    try {
      const { escrowId, txHash } = await createEscrowOnChain({
        signer,
        freelancer: freelancerAddress,
        deadline: dayjs(deadline).unix(), // 合约要 unix 秒(见 docs/api-spec.md 4.1)
        descriptions: milestones.map((m) => m.description.trim()),
        amounts: milestones.map((m) => parseEther(String(m.amountEth))),
      })

      notifications.update({
        id: 'create-flow',
        title: 'Transaction submitted',
        message: 'Waiting for on-chain confirmation…',
        color: 'blue',
        loading: true,
        autoClose: false,
      })

      await createEscrowMetadata({
        escrow_id: escrowId,
        client_address: address,
        freelancer_address: freelancerAddress,
        title: title.trim(),
        description: description.trim() || undefined,
        total_amount_wei: totalWei.toString(),
        deadline: dayjs(deadline).toISOString(),
        tx_hash_create: txHash,
        milestones: milestones.map((m, i) => ({
          milestone_index: i,
          description: m.description.trim(),
          amount_wei: parseEther(String(m.amountEth)).toString(),
        })),
      })

      notifications.update({
        id: 'create-flow',
        title: 'Escrow created',
        message: `escrow_id=${escrowId} — next step: fund the escrow to lock the funds.`,
        color: 'green',
        loading: false,
        autoClose: 6000,
      })
      setCreatedId(escrowId)
      setActive(3)
    } catch (err) {
      if (err?.message === 'CONTRACT_NOT_DEPLOYED') {
        notifications.update({
          id: 'create-flow',
          title: 'On-chain create not wired yet',
          message: 'This is a UI preview — the smart contract integration will be added after deployment.',
          color: 'yellow',
          loading: false,
          autoClose: 6000,
        })
      } else {
        notifications.update({
          id: 'create-flow',
          title: 'Create failed',
          message: err?.message || 'Unknown error',
          color: 'red',
          loading: false,
          autoClose: 6000,
        })
      }
    } finally {
      setCreating(false)
    }
  }

  return (
    <Stack gap="lg">
      <div>
        <Title order={2}>Create Escrow</Title>
        <Text size="sm" c="dimmed" mt={4}>
          Set up a milestone-based escrow — funds are locked in the contract and released
          milestone by milestone.
        </Text>
      </div>

      <Stepper active={active} onStepClick={setActive} allowNextStepsSelect={false}>
        <Stepper.Step label="Basic Info" description="Project details">
          <Stack gap="md" mt="lg" maw={560}>
            <TextInput
              label="Freelancer wallet address"
              placeholder="0x…"
              withAsterisk
              {...form.getInputProps('freelancerAddress')}
            />
            <TextInput label="Project title" withAsterisk {...form.getInputProps('title')} />
            <Textarea
              label="Project description"
              placeholder="What should the freelancer deliver?"
              autosize
              minRows={3}
              {...form.getInputProps('description')}
            />
            <DatePickerInput
              label="Deadline"
              placeholder="Pick a date"
              withAsterisk
              valueFormat="YYYY-MM-DD"
              minDate={dayjs().format('YYYY-MM-DD')}
              {...form.getInputProps('deadline')}
            />
            <Group justify="flex-end">
              <Button onClick={nextStep}>Next</Button>
            </Group>
          </Stack>
        </Stepper.Step>

        <Stepper.Step label="Milestones" description="Phases & amounts">
          <Stack gap="md" mt="lg" maw={640}>
            {form.values.milestones.map((_, index) => (
              <Group key={form.key(`milestones.${index}.description`)} gap="sm" align="flex-start" wrap="nowrap">
                <TextInput
                  label={index === 0 ? 'Description' : undefined}
                  placeholder={`Milestone ${index + 1} — e.g. UI Design`}
                  style={{ flex: 1 }}
                  {...form.getInputProps(`milestones.${index}.description`)}
                />
                <NumberInput
                  label={index === 0 ? 'Amount' : undefined}
                  placeholder="0.5"
                  decimalScale={MAX_AMOUNT_DECIMALS}
                  min={0}
                  w={150}
                  rightSection={<Text size="xs" c="dimmed">ETH</Text>}
                  rightSectionWidth={40}
                  {...form.getInputProps(`milestones.${index}.amountEth`)}
                />
                <ActionIcon
                  variant="subtle"
                  color="red"
                  mt={index === 0 ? 26 : 0}
                  disabled={form.values.milestones.length <= 1}
                  onClick={() => removeMilestone(index)}
                  aria-label={`Remove milestone ${index + 1}`}
                >
                  <IconTrash size={16} stroke={1.5} />
                </ActionIcon>
              </Group>
            ))}

            <Button
              variant="light"
              leftSection={<IconPlus size={16} stroke={1.5} />}
              onClick={addMilestone}
            >
              Add Milestone
            </Button>

            <Card withBorder padding="md">
              <Group justify="space-between">
                <Text size="sm" c="dimmed">Total</Text>
                <Mono size="lg" fw={700}>
                  {formatEth(totalWei.toString())} ETH
                </Mono>
              </Group>
            </Card>

            <Group justify="space-between">
              <Button variant="default" onClick={() => setActive(0)}>Back</Button>
              <Button onClick={nextStep}>Next</Button>
            </Group>
          </Stack>
        </Stepper.Step>

        <Stepper.Step label="Review" description="Confirm & create">
          <Stack gap="md" mt="lg" maw={640}>
            <Card withBorder padding="lg">
              <Stack gap="sm">
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">Title</Text>
                  <Text size="sm" fw={600}>{form.values.title.trim()}</Text>
                </Group>
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">Freelancer</Text>
                  <AddressText address={form.values.freelancerAddress} />
                </Group>
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">Deadline</Text>
                  <Text size="sm">{dayjs(form.values.deadline).format('YYYY-MM-DD')}</Text>
                </Group>
                {form.values.description.trim() && (
                  <Group justify="space-between" align="flex-start">
                    <Text size="sm" c="dimmed">Description</Text>
                    <Text size="sm" maw={380} style={{ textAlign: 'right' }}>
                      {form.values.description.trim()}
                    </Text>
                  </Group>
                )}
                <Divider my="xs" />
                {form.values.milestones.map((m, i) => (
                  <Group key={i} justify="space-between">
                    <Text size="sm">
                      M{i + 1} · {m.description.trim()}
                    </Text>
                    <Mono size="sm">{m.amountEth} ETH</Mono>
                  </Group>
                ))}
                <Divider my="xs" />
                <Group justify="space-between">
                  <Text size="sm" fw={600}>Total</Text>
                  <Mono size="lg" fw={700}>{formatEth(totalWei.toString())} ETH</Mono>
                </Group>
              </Stack>
            </Card>

            <Group justify="space-between">
              <Button variant="default" onClick={() => setActive(1)}>Back</Button>
              <Tooltip
                refProp="rootRef"
                label="Connect your wallet first"
                withArrow
                disabled={Boolean(address)}
              >
                <Button
                  loading={creating}
                  disabled={!address}
                  leftSection={<IconWallet size={16} stroke={1.5} />}
                  onClick={handleCreate}
                >
                  Create Escrow
                </Button>
              </Tooltip>
            </Group>
          </Stack>
        </Stepper.Step>

        <Stepper.Completed>
          <Center py="xl">
            <Stack align="center" gap="xs">
              <ThemeIcon variant="light" color="green" size={64} radius="xl">
                <IconCircleCheck size={32} stroke={1.25} />
              </ThemeIcon>
              <Title order={4}>Escrow created</Title>
              <Text size="sm" c="dimmed">
                escrow_id=<Mono inherit>{createdId}</Mono> — next step: fund the escrow to lock
                the funds in the contract.
              </Text>
              <Button component={Link} to="/" mt="md">
                Back to Dashboard
              </Button>
            </Stack>
          </Center>
        </Stepper.Completed>
      </Stepper>
    </Stack>
  )
}
