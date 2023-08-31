const { ethers } = require("hardhat");
const PRICE = ethers.utils.parseEther("0.1");
const gasLimit = 4000000;

async function mintAndList() {
  const nftMarketPlace = await ethers.getContract("NftMarketplace");
  const basicNft = await ethers.getContract("BasicNft");
  console.log("Minting...");
  const mintTx = await basicNft.mintNft();
  const mintTxReceipt = await mintTx.wait(1);
  const TOKEN_ID = mintTxReceipt.events[0].args.tokenId;
  console.log("Approving Nft...")
  const approvalTx = await basicNft.approve(nftMarketPlace.address, TOKEN_ID)
  await approvalTx.wait(1)
  console.log("Listing NFT...")
  const listingTx = await nftMarketPlace.listItem(basicNft.address, TOKEN_ID, PRICE,  {gasLimit: gasLimit})
  await listingTx.wait(1)
  console.log("Listed!...")
}

mintAndList()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
