/**
 * BSC 代币自动发送服务
 *
 * 合约地址：0xF6417bc146A98CCbe4aF9CAe8266Fd65be25e5AF（项目代币，18位精度）
 * 链：BNB Chain (BSC) 主网，chainId = 56
 *
 * 依赖：viem v2（支持 Cloudflare Workers 边缘运行时）
 * 私钥通过 Cloudflare Worker Secret 注入（env.DISTRIBUTION_PRIVATE_KEY）
 *
 * 流程：
 *   1. 用积分兑换接口扣除用户积分
 *   2. 调用 sendToken() 广播链上 transfer() 交易
 *   3. 返回 txHash（不等待确认，用户可自行在 BSCScan 查验）
 */

import { createWalletClient, http, parseUnits } from 'viem'
import { bsc } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'

// ── 合约配置 ──
const TOKEN_CONTRACT = '0xF6417bc146A98CCbe4aF9CAe8266Fd65be25e5AF'
const TOKEN_DECIMALS = 18

// BSC 公共 RPC（主备两个，防止单点故障）
const BSC_RPC_URLS = [
    'https://bsc-dataseed1.binance.org',
    'https://bsc-dataseed2.binance.org',
    'https://bsc-dataseed1.defibit.io'
]

// ERC-20 transfer 最小 ABI
const ERC20_ABI = [
    {
        name: 'transfer',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
            { name: 'to', type: 'address' },
            { name: 'amount', type: 'uint256' }
        ],
        outputs: [{ type: 'bool' }]
    }
]

/**
 * 发送 ERC-20 代币到指定 BSC 地址
 *
 * @param {string} toAddress    接收方钱包地址（0x开头 42位）
 * @param {number} tokenAmount  整数代币数量（如 100 表示 100个代币）
 * @param {string} privateKey   发币钱包私钥（0x 开头的 64位 hex）
 * @returns {Promise<string>}   链上交易哈希 txHash
 * @throws                      发送失败时抛出错误，调用方应 catch 并保留 pending 状态
 */
export async function sendToken(toAddress, tokenAmount, privateKey) {
    // 规范化私钥格式（确保 0x 前缀）
    const pk = String(privateKey).startsWith('0x')
        ? privateKey
        : `0x${privateKey}`

    // 创建账户（从私钥）
    const account = privateKeyToAccount(pk)

    // 创建 walletClient（使用第一个可用 RPC）
    const walletClient = createWalletClient({
        account,
        chain: bsc,
        transport: http(BSC_RPC_URLS[0], {
            timeout: 20_000,  // 20秒超时
            retryCount: 2,
            retryDelay: 1000
        })
    })

    // 计算代币精度金额（tokenAmount * 10^18）
    const amountInWei = parseUnits(String(tokenAmount), TOKEN_DECIMALS)

    // 广播交易（不等待链上确认，直接返回 txHash）
    const txHash = await walletClient.writeContract({
        address: TOKEN_CONTRACT,
        abi: ERC20_ABI,
        functionName: 'transfer',
        args: [toAddress, amountInWei],
        gas: BigInt(100_000)  // ERC-20 transfer 约需 65k gas，设100k留余量
    })

    return txHash
}
