# Etherscan Contract Fetcher

A CLI tool for fetching verified smart contract source code from Etherscan using the unified v2 API. Optimized for AI agents and automated workflows.

## Installation

### Global Installation (Recommended)

```bash
# Install globally from npm
npm install -g etherscan-contract-fetcher

# Or using yarn
yarn global add etherscan-contract-fetcher

# Or install directly from GitHub
npm install -g git+https://github.com/cyhhao/etherscan-contract-fetcher.git
```

After global installation, the `fetch-contract` command will be available anywhere in your terminal.

### Local Installation

```bash
# Clone and install locally
git clone https://github.com/cyhhao/etherscan-contract-fetcher.git
cd etherscan-contract-fetcher
npm install
npm link  # Optional: Make available globally
```

## Features

- **Unified API**: Single API key for 50+ EVM chains via Etherscan v2 API
- **Smart Detection**: Distinguishes between EOAs, unverified contracts, and proxy contracts
- **Proxy Support**: Automatically detects proxy contracts and shows implementation addresses
- **Multi-file Contracts**: Preserves directory structure for complex contracts
- **AI-Optimized**: Minimal output, clear error messages, designed for automated use

## Setup

Get your Etherscan API key from https://etherscan.io/apis and save it:

```bash
echo "YOUR_API_KEY" > ~/.etherscankey
```

This single API key works for all supported chains including Ethereum, BSC, Polygon, Arbitrum, Optimism, Base, and more.

## Usage

### Basic Usage

```bash
# Fetch contract source code
node cli.js fetch -c <chainId> -a <address> -o <outputPath>

# List supported chains
node cli.js chains

# Show help
node cli.js help
```

### Examples

```bash
# Fetch USDC from Ethereum mainnet
node cli.js fetch -c 1 -a 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 -o ./contracts/usdc

# Fetch Multicall3 (same address on all chains)
node cli.js fetch -c 1 -a 0xcA11bde05977b3631167028862bE2a173976CA11 -o ./contracts/multicall3

# Address without 0x prefix (auto-fixed)
node cli.js fetch -c 1 -a cA11bde05977b3631167028862bE2a173976CA11 -o ./contracts/multicall3
```

## Supported Chains

| Chain ID | Network |
|----------|---------|
| 1 | Ethereum Mainnet |
| 56 | BNB Smart Chain |
| 137 | Polygon |
| 42161 | Arbitrum One |
| 10 | Optimism |
| 43114 | Avalanche C-Chain |
| 250 | Fantom |
| 8453 | Base |
| 81457 | Blast |
| 534352 | Scroll |
| 59144 | Linea |
| 11155111 | Sepolia Testnet |
| 5 | Goerli Testnet |

## Output Structure

The tool saves:
- Contract source code files (preserving original structure)
- `metadata.json` with compiler settings and contract info
- Proxy information (if applicable)

Example output structure:
```
./contracts/usdc/
├── Contract.sol          # Main contract file(s)
└── metadata.json         # Compilation settings and proxy info
```

## Error Handling

The tool provides clear, concise error messages:
- `EOA address: 0x...` - Address is a wallet, not a contract
- `Unverified contract: 0x...` - Contract exists but source not published
- `Proxy → 0x...` - Proxy detected with implementation address

## API Rate Limits

Etherscan API has rate limits. If you encounter rate limit errors, wait a moment before retrying.

## License

MIT

## Contributing

Issues and PRs welcome at https://github.com/cyhhao/etherscan-contract-fetcher