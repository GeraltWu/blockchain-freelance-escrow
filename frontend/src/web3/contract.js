import { Contract } from 'ethers'

// 合约接入层(对应 docs/architecture.md web3/contract.js)
// TODO(合约):在 Remix 部署 FreelanceEscrow.sol 之后:
//   1. 编译后复制 ABI,保存为 src/web3/abi/FreelanceEscrow.json 并在这里 import
//   2. 在 frontend/.env 里设置 VITE_CONTRACT_ADDRESS=<部署地址>
//   3. 下面的 CONTRACT_NOT_DEPLOYED 分支会自动失效,恢复真实调用

const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS
const ABI = [] // TODO(合约):替换为 FreelanceEscrow ABI

export function getContract(signer) {
  if (!CONTRACT_ADDRESS) {
    throw new Error('CONTRACT_NOT_DEPLOYED')
  }
  return new Contract(CONTRACT_ADDRESS, ABI, signer)
}

// createEscrow(freelancer, deadline, descriptions[], amounts[]) → { escrowId, txHash }
// 函数签名见 docs/api-spec.md 4.1;交易确认后从 EscrowCreated 事件解析 escrowId
export async function createEscrowOnChain({ signer, freelancer, deadline, descriptions, amounts }) {
  if (!CONTRACT_ADDRESS) {
    // 合约未部署:调用方据此提示「UI 预览,链上流程未接线」
    throw new Error('CONTRACT_NOT_DEPLOYED')
  }
  const contract = getContract(signer)
  const tx = await contract.createEscrow(freelancer, deadline, descriptions, amounts)
  const receipt = await tx.wait()
  // TODO(合约):从 receipt.logs 解析 EscrowCreated 事件拿到 escrowId
  return { escrowId: null, txHash: receipt.hash }
}
