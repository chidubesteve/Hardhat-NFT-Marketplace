const { ethers, network } = require("hardhat");
const { developmentChains } = require("../helper-hardhat-config");
const { verify } = require("../utils/verify");

module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();
  const  deployerSigner = await ethers.getSigner(deployer)
  const nonce = await deployerSigner.getTransactionCount()


  args = [];
  const nftMarketPlace = await deploy("NftMarketplace", {
    from: deployer,
    nonce: nonce,
    args: args,
    log: true,
    waitConfirmations: network.config.blockConfirmations || 1,
  });
  if (!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
    log("Verifying......");
    await verify(nftMarketPlace.address, args);
    log("Verified!");
  }
  log("######################################");
};
module.exports.tags = ["all", "nftmarketplace"];
