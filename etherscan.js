import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Etherscan v2 API unified endpoint - single API key for all chains
const API_V2_ENDPOINT = 'https://api.etherscan.io/v2/api';

const CHAIN_CONFIGS = {
  1: { name: 'Ethereum Mainnet' },
  56: { name: 'BNB Smart Chain' },
  137: { name: 'Polygon' },
  42161: { name: 'Arbitrum One' },
  10: { name: 'Optimism' },
  43114: { name: 'Avalanche C-Chain' },
  250: { name: 'Fantom' },
  8453: { name: 'Base' },
  81457: { name: 'Blast' },
  534352: { name: 'Scroll' },
  59144: { name: 'Linea' },
  11155111: { name: 'Sepolia Testnet' },
  5: { name: 'Goerli Testnet' },
};

export class EtherscanClient {
  constructor(apiKey) {
    this.apiKey = apiKey;
  }

  async getApiKey() {
    if (this.apiKey) return this.apiKey;

    const keyFilePath = path.join(os.homedir(), '.etherscankey');
    try {
      const key = await fs.readFile(keyFilePath, 'utf-8');
      return key.trim();
    } catch (error) {
      throw new Error(`Unable to read API key from ~/.etherscankey: ${error.message}`);
    }
  }

  validateChainId(chainId) {
    const config = CHAIN_CONFIGS[chainId];
    if (!config) {
      throw new Error(`Unsupported chain ID: ${chainId}. Use 'fetch-contract chains' to see supported chains.`);
    }
    return config;
  }

  async isContract(chainId, address) {
    const apiKey = await this.getApiKey();

    try {
      // Use eth_getCode to check if address has code
      const response = await axios.get(API_V2_ENDPOINT, {
        params: {
          chainid: chainId,
          module: 'proxy',
          action: 'eth_getCode',
          address: address,
          tag: 'latest',
          apikey: apiKey
        }
      });

      if (response.data.status === '1' && response.data.result) {
        // If result is '0x' or empty, it's an EOA
        // If it has bytecode, it's a contract
        return response.data.result !== '0x' && response.data.result !== '';
      } else if (response.data.result === '0x') {
        // Explicitly EOA
        return false;
      }

      // If we can't determine, assume it might be a contract
      return true;
    } catch (error) {
      // If the check fails, assume it might be a contract to avoid false negatives
      console.warn('Could not determine if address is contract, assuming it might be');
      return true;
    }
  }

  async fetchContractSource(chainId, address) {
    const apiKey = await this.getApiKey();
    this.validateChainId(chainId);

    try {
      // Using Etherscan v2 API unified endpoint
      const response = await axios.get(API_V2_ENDPOINT, {
        params: {
          chainid: chainId,  // v2 API uses chainid parameter
          module: 'contract',
          action: 'getsourcecode',
          address: address,
          apikey: apiKey
        }
      });

      if (response.data.status !== '1') {
        const errorMsg = response.data.message || response.data.result || 'Failed to fetch contract source';

        // Provide more specific error messages
        if (errorMsg.includes('Invalid API Key') || errorMsg.includes('invalid API key')) {
          throw new Error(`Invalid API key`);
        } else if (errorMsg.includes('Max rate limit reached')) {
          throw new Error(`Rate limit exceeded`);
        }

        throw new Error(`API Error: ${errorMsg}`);
      }

      if (!response.data.result || response.data.result.length === 0) {
        throw new Error('No contract found at this address');
      }

      const contract = response.data.result[0];

      if (!contract.SourceCode || contract.SourceCode === '') {
        // Check if it's actually a contract or just an EOA
        const isContract = await this.isContract(chainId, address);
        const chainName = CHAIN_CONFIGS[chainId]?.name || `chain ${chainId}`;

        if (!isContract) {
          throw new Error(`EOA address: ${address}`);
        } else {
          throw new Error(`Unverified contract: ${address}`);
        }
      }

      // Add proxy info from API response
      if (contract.Proxy === '1') {
        contract.proxyInfo = {
          isProxy: true,
          implementation: contract.Implementation || null
        };
      }

      return contract;
    } catch (error) {
      if (error.response) {
        throw new Error(`HTTP Error: ${error.response.status} - ${error.response.statusText}`);
      }
      throw error;
    }
  }

  parseSourceCode(sourceCode) {
    if (sourceCode.startsWith('{{')) {
      try {
        const parsed = JSON.parse(sourceCode.slice(1, -1));
        const sources = parsed.sources || {};
        const files = [];

        for (const [filePath, content] of Object.entries(sources)) {
          // Remove unnecessary wrapper directories like 'solc_0.8/'
          let cleanPath = filePath;
          if (cleanPath.match(/^solc_[\d.]+\//)) {
            cleanPath = cleanPath.replace(/^solc_[\d.]+\//, '');
          }
          files.push({
            path: cleanPath,
            content: content.content || ''
          });
        }

        return files;
      } catch (error) {
        console.warn('Failed to parse multi-file format, treating as single file');
        return [{ path: 'Contract.sol', content: sourceCode }];
      }
    } else if (sourceCode.startsWith('{')) {
      try {
        const parsed = JSON.parse(sourceCode);
        if (parsed.language === 'Solidity' && parsed.sources) {
          const files = [];
          for (const [filePath, source] of Object.entries(parsed.sources)) {
            // Remove unnecessary wrapper directories like 'solc_0.8/'
            let cleanPath = filePath;
            if (cleanPath.match(/^solc_[\d.]+\//)) {
              cleanPath = cleanPath.replace(/^solc_[\d.]+\//, '');
            }
            files.push({
              path: cleanPath,
              content: source.content || ''
            });
          }
          return files;
        }
      } catch (error) {
        console.warn('Failed to parse JSON format, treating as single file');
      }
    }

    return [{ path: 'Contract.sol', content: sourceCode }];
  }

  async saveContractFiles(contract, localPath) {
    const files = this.parseSourceCode(contract.SourceCode);

    await fs.mkdir(localPath, { recursive: true });

    const savedFiles = [];

    for (const file of files) {
      const filePath = path.join(localPath, file.path);
      const fileDir = path.dirname(filePath);

      await fs.mkdir(fileDir, { recursive: true });

      await fs.writeFile(filePath, file.content, 'utf-8');
      savedFiles.push(filePath);
    }

    const metadataPath = path.join(localPath, 'metadata.json');
    const metadata = {
      contractName: contract.ContractName,
      compilerVersion: contract.CompilerVersion,
      optimizationUsed: contract.OptimizationUsed === '1',
      runs: parseInt(contract.Runs) || 0,
      evmVersion: contract.EVMVersion || 'default',
      library: contract.Library || '',
      licenseType: contract.LicenseType || '',
      proxy: contract.Proxy || '0',
      implementation: contract.Implementation || '',
      swarmSource: contract.SwarmSource || ''
    };

    // Add detailed proxy information if available
    if (contract.proxyInfo) {
      metadata.proxyInfo = contract.proxyInfo;
    }

    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');
    savedFiles.push(metadataPath);

    return savedFiles;
  }
}