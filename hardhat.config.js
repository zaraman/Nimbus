const { TASK_COMPILE_SOLIDITY_GET_SOURCE_PATHS } = require("hardhat/builtin-tasks/task-names");
const path = require("path");
require('@nomiclabs/hardhat-waffle')
require('@openzeppelin/hardhat-upgrades');
require('dotenv').config()
require('@nomiclabs/hardhat-etherscan')

const BSC_PRIVATE_KEY = process.env.BSC_PRIVATE_KEY || '0x0000000000000000000000000000000000000000000000000000000000000001'
const BSCSCANAPIKEY_API_KEY = process.env.BSCSCANAPIKEY_API_KEY || ''
const BSC_TESTNET = process.env.BSC_TESTNET || 'https://bsc-testnet.public.blastapi.io'
const BSC_MAINNET = process.env.BSC_MAINNET || 'https://bscrpc.com/'

module.exports = {
  solidity: {
    compilers: [
      {
        version: '0.5.17'
      },
      {
        version: '0.8.14'
      },
      {
        version: '0.5.16'
      },
      {
        version: '0.8.0',
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: '0.8.9',
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: '0.8.7',
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: '0.8.15',
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: '0.8.20',
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ],
  },
  defaultNetwork: 'hardhat',
  networks: {
    hardhat: {
      forking: {
        url: BSC_MAINNET
      },
      initialBaseFeePerGas: 0,
      blockGasLimit: 99999999999999,
      gas: 99999999999999,
      gasPrice: 1,
      allowUnlimitedContractSize: true,
      accounts: {
        count: 120
      }
    },
    testnet: {
      url: BSC_TESTNET,
      chainId: 97,
      gasPrice: 16000000000,
      gas: 2100000,
      accounts: [BSC_PRIVATE_KEY],
    },
    mainnet: {
      url: BSC_MAINNET,
      chainId: 56,
      gasPrice: 10000000000,
      accounts: [BSC_PRIVATE_KEY],
    },
  },
  etherscan: {
    apiKey: {
      // binance smart chain
      bsc: BSCSCANAPIKEY_API_KEY,
      bscTestnet: BSCSCANAPIKEY_API_KEY,
    },
  },
  mocha: {
    timeout: 100000000
  },
  docgen: {
    pages: 'files',
    exclude: ['Stakings', 'Test']
  }
}
