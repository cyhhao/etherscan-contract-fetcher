#!/usr/bin/env node

import { program } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';
import { EtherscanClient } from './etherscan.js';

program
  .name('fetch-contract')
  .description('CLI tool to fetch contract source code from Etherscan - optimized for AI usage')
  .version('1.0.0')
  .helpOption('-h, --help', 'Display help for command');

program
  .command('fetch')
  .description('Fetch contract source code from Etherscan')
  .requiredOption('-c, --chain <chainId>', 'Chain ID (e.g., 1 for Ethereum, 56 for BSC)')
  .requiredOption('-a, --address <address>', 'Contract address')
  .requiredOption('-o, --output <path>', 'Local path to save the contract files')
  .option('-k, --api-key <key>', 'Etherscan API key (defaults to reading from ~/.etherscankey)')
  .action(async (options) => {
    const spinner = ora();

    try {
      const chainId = parseInt(options.chain);
      if (isNaN(chainId)) {
        throw new Error('Invalid chain ID. Must be a number.');
      }

      let address = options.address;

      // Auto-fix common address issues
      if (!address.startsWith('0x') && !address.startsWith('0X')) {
        address = '0x' + address;
        console.log(chalk.yellow('⚠️  Auto-adding 0x prefix to address'));
      }

      // Validate address format (case-insensitive check)
      if (!address.match(/^0x[a-fA-F0-9]{40}$/i)) {
        throw new Error(`Invalid contract address format: ${address}\n   Expected format: 0x followed by 40 hexadecimal characters\n   Example: 0xcA11bde05977b3631167028862bE2a173976CA11`);
      }

      const outputPath = path.resolve(options.output);

      // Ensure output directory exists
      try {
        await fs.mkdir(outputPath, { recursive: true });
      } catch (err) {
        // Continue even if directory creation fails
      }

      const client = new EtherscanClient(options.apiKey);

      spinner.start('Fetching...');
      const contract = await client.fetchContractSource(chainId, address);
      const savedFiles = await client.saveContractFiles(contract, outputPath);
      spinner.succeed('Done');

      // Display proxy information if this is a proxy contract
      if (contract.proxyInfo && contract.proxyInfo.isProxy && contract.proxyInfo.implementation) {
        console.log(chalk.yellow(`Proxy → ${contract.proxyInfo.implementation}`));
      }

      console.log(`\nFiles: ${savedFiles.length}`);

      // Show first-level files/directories for AI to navigate
      const fileStructure = new Set();
      savedFiles.forEach(file => {
        const relativePath = path.relative(outputPath, file);
        const firstLevel = relativePath.split(path.sep)[0];
        if (firstLevel && firstLevel !== 'metadata.json') {
          fileStructure.add(firstLevel);
        }
      });

      if (fileStructure.size > 0) {
        console.log('Structure:', Array.from(fileStructure).sort().join(', '));
      }

      console.log(`Contract: ${contract.ContractName || 'Unknown'}`);
      console.log(`Compiler: ${contract.CompilerVersion || 'Unknown'}`);
      if (contract.OptimizationUsed === '1') {
        console.log(`Optimization: Yes (${contract.Runs} runs)`);
      } else {
        console.log(`Optimization: No`);
      }

    } catch (error) {
      spinner.fail('Failed to fetch contract');
      console.error(chalk.red(`\n❌ Error: ${error.message}`));

      // Provide helpful suggestions based on error type
      if (error.message.includes('API key')) {
        console.log(chalk.gray('Tip: Check ~/.etherscankey or use -k flag'));
      } else if (error.message.includes('Unverified')) {
        console.log(chalk.gray('Tip: Contract exists but source not published'));
      } else if (error.message.includes('EOA')) {
        console.log(chalk.gray('Tip: This is a wallet address, not a contract'));
      } else if (error.message.includes('chain')) {
        console.log(chalk.gray('Tip: Use "fetch-contract chains" for valid chain IDs'));
      }

      process.exit(1);
    }
  });

program
  .command('help')
  .description('Show detailed help and usage examples')
  .action(() => {
    console.log('\nUsage:');
    console.log('  fetch-contract fetch -c <chainId> -a <address> -o <outputPath>');
    console.log('  fetch-contract chains');
    console.log('  fetch-contract help');
    console.log('\nOptions:');
    console.log('  -c, --chain <id>    : Chain ID (required)');
    console.log('  -a, --address <addr>: Contract address (required)');
    console.log('  -o, --output <path> : Output directory (required)');
    console.log('  -k, --api-key <key> : API key (optional, uses ~/.etherscankey)');
    console.log('\nExamples:');
    console.log('  fetch-contract fetch -c 1 -a 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 -o ./usdc');
    console.log('  fetch-contract fetch -c 56 -a 0xcA11bde05977b3631167028862bE2a173976CA11 -o ./multicall3');
  });

program
  .command('chains')
  .description('List supported chain IDs')
  .action(() => {
    console.log(chalk.blue('📋 Supported chains:'));
    console.log();
    const chains = [
      { id: 1, name: 'Ethereum Mainnet' },
      { id: 56, name: 'BNB Smart Chain' },
      { id: 137, name: 'Polygon' },
      { id: 42161, name: 'Arbitrum One' },
      { id: 10, name: 'Optimism' },
      { id: 43114, name: 'Avalanche C-Chain' },
      { id: 250, name: 'Fantom' },
      { id: 8453, name: 'Base' },
      { id: 81457, name: 'Blast' },
      { id: 534352, name: 'Scroll' },
      { id: 59144, name: 'Linea' },
      { id: 11155111, name: 'Sepolia Testnet' },
      { id: 5, name: 'Goerli Testnet' },
    ];

    chains.forEach(chain => {
      console.log(chalk.gray(`  ${chain.id.toString().padEnd(10)} - ${chain.name}`));
    });
  });

// Show help if no command provided
if (process.argv.length === 2) {
  program.outputHelp();
  console.log(chalk.gray('\n💡 Tip: Use "fetch-contract help" for detailed usage examples'));
}

program.parse();