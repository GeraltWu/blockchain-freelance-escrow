import { Contract } from 'ethers'
import FreelanceEscrowABI from './abi/FreelanceEscrow.json'

// 合约接入层(对应 docs/architecture.md web3/contract.js)
// 合约地址在 frontend/.env 的 VITE_CONTRACT_ADDRESS;ABI 来自 contracts/artifacts(npm run sync:abi 同步)
const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS

export function getContract(signerOrProvider) {
  if (!CONTRACT_ADDRESS) {
    throw new Error('CONTRACT_NOT_DEPLOYED')
  }
  return new Contract(CONTRACT_ADDRESS, FreelanceEscrowABI, signerOrProvider)
}

// 从 ethers 错误里提取可读信息(MetaMask 拒绝 / 合约 revert 原因)
export function txErrorMessage(err) {
  return err?.shortMessage || err?.reason || err?.message || 'Unknown error'
}

// 通用发送:广播交易 → onSubmitted(txHash) → 等上链 → { txHash, blockNumber }
// 三段式通知的中间段由调用方在 onSubmitted 里处理(ui-design.md 七)
async function sendTx({ signer, method, args = [], value, onSubmitted }) {
  if (!CONTRACT_ADDRESS) {
    throw new Error('CONTRACT_NOT_DEPLOYED')
  }
  const contract = getContract(signer)
  const overrides = value != null ? { value } : {}
  const tx = await contract[method](...args, overrides)
  onSubmitted?.(tx.hash)
  const receipt = await tx.wait()
  return { txHash: receipt.hash, blockNumber: receipt.blockNumber }
}

// createEscrow(freelancer, deadline, descriptions[], amounts[]) → { escrowId, txHash }
// 函数签名见 docs/api-spec.md 4.1;escrowId 从 EscrowCreated 事件解析
export async function createEscrowOnChain({ signer, freelancer, deadline, descriptions, amounts, onSubmitted }) {
  if (!CONTRACT_ADDRESS) {
    throw new Error('CONTRACT_NOT_DEPLOYED')
  }
  const contract = getContract(signer)
  const tx = await contract.createEscrow(freelancer, deadline, descriptions, amounts)
  onSubmitted?.(tx.hash)
  const receipt = await tx.wait()

  const iface = contract.interface
  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog(log)
      if (parsed?.name === 'EscrowCreated') {
        return {
          escrowId: Number(parsed.args.escrowId),
          txHash: receipt.hash,
          blockNumber: receipt.blockNumber,
        }
      }
    } catch {
      // 不是本合约的日志,跳过
    }
  }
  throw new Error('EscrowCreated event not found in transaction receipt')
}

// fundEscrow(escrowId) payable —— 一次性全额存入(api-spec 4.2)
export function fundEscrowOnChain({ signer, escrowId, amountWei, onSubmitted }) {
  return sendTx({
    signer,
    method: 'fundEscrow',
    args: [escrowId],
    value: BigInt(amountWei),
    onSubmitted,
  })
}

// submitMilestone(escrowId, milestoneIndex)(api-spec 4.3)
export function submitMilestoneOnChain({ signer, escrowId, milestoneIndex, onSubmitted }) {
  return sendTx({ signer, method: 'submitMilestone', args: [escrowId, milestoneIndex], onSubmitted })
}

// approveMilestone(escrowId, milestoneIndex) —— 批准并放款(api-spec 4.4)
export function approveMilestoneOnChain({ signer, escrowId, milestoneIndex, onSubmitted }) {
  return sendTx({ signer, method: 'approveMilestone', args: [escrowId, milestoneIndex], onSubmitted })
}

// raiseDispute(escrowId, milestoneIndex)(api-spec 4.5)
export function raiseDisputeOnChain({ signer, escrowId, milestoneIndex, onSubmitted }) {
  return sendTx({ signer, method: 'raiseDispute', args: [escrowId, milestoneIndex], onSubmitted })
}

// resolveDispute(escrowId, milestoneIndex, releaseToFreelancer)(api-spec 4.6)
export function resolveDisputeOnChain({ signer, escrowId, milestoneIndex, releaseToFreelancer, onSubmitted }) {
  return sendTx({
    signer,
    method: 'resolveDispute',
    args: [escrowId, milestoneIndex, releaseToFreelancer],
    onSubmitted,
  })
}

// refund(escrowId, milestoneIndex) —— 超时退款(api-spec 4.7)
export function refundOnChain({ signer, escrowId, milestoneIndex, onSubmitted }) {
  return sendTx({ signer, method: 'refund', args: [escrowId, milestoneIndex], onSubmitted })
}
