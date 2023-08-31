const { ethers, network } = require("hardhat");
const { moveBlocks } = require("../utils/move-blocks");


async function cancelListing() {
  const TOKEN_ID = 1;
const gasLimit = 4000000;

  const nftMarketPlace = await ethers.getContract("NftMarketplace");
  const basicNft = await ethers.getContract("BasicNft");
  const tx = await nftMarketPlace.cancelListing(basicNft.address, TOKEN_ID, {
    gasLimit: gasLimit,
  });
  await tx.wait(1);
  console.log("Item Cancelled!");
  // Move blocks to allow for the item to be removed from marketplaces
  if (network.config.chainId == 31337) {
    await moveBlocks(2, (sleepAmount = 1000));
  }
}

cancelListing()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
