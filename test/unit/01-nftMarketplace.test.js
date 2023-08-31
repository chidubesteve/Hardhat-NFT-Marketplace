const { assert, expect } = require("chai");
const { developmentChains } = require("../../helper-hardhat-config");
const { network, deployments, ethers } = require("hardhat");

!developmentChains.includes(network.name)
  ? describe.skip
  : describe("NftMarketplace unit tests", () => {
      let nftMarketPlace,
        nftMarketPlaceContract,
        basicNft,
        basicNftContract,
        deployer,
        accounts;
      const PRICE = ethers.utils.parseEther("0.1");
      const TOKEN_ID = 0;

      beforeEach(async () => {
        // with getNamedAccounts
        // deployer = (await getNamedAccounts()).deployer
        // player = await getNamedAccounts()).player
        // because of the player in the hardhat.config

        accounts = await ethers.getSigners();
        deployer = accounts[0];
        user = accounts[1];
        await deployments.fixture(["all"]);
        nftMarketPlaceContract = await ethers.getContract("NftMarketplace");
        nftMarketPlace = await nftMarketPlaceContract.connect(deployer);
        basicNftContract = await ethers.getContract("BasicNft");
        basicNft = await basicNftContract.connect(deployer);
        await basicNft.mintNft();
        await basicNft.approve(nftMarketPlaceContract.address, TOKEN_ID);
      });
      describe("listItem", () => {
        it("emits an event when an NFT is listed", async () => {
          expect(
            await nftMarketPlace.listItem(basicNft.address, TOKEN_ID, PRICE)
          ).to.emit("ItemListed");
        });
        it("reverts nft listing if not approved by the contract", async () => {
          const unAuthorizedAddress = accounts[2]; // an address that is not the owner

          // test the NFT using an unauthorized address
          await basicNft.approve(unAuthorizedAddress.address, TOKEN_ID);

          await expect(
            nftMarketPlace.listItem(basicNft.address, TOKEN_ID, PRICE)
          ).to.be.revertedWith("NftMarketplace__NotApprovedForMarketPlace");
        });
        it("reverts if the NFT's price be 0", async () => {
          const ZERO_PRICE = ethers.utils.parseEther("0");
          await expect(
            nftMarketPlace.listItem(basicNft.address, TOKEN_ID, ZERO_PRICE)
          ).to.be.revertedWith("NftMarketplace__PriceMustBeAboveZero");
        });
        it("throws an error when trying to list an NFT not owned by caller", async () => {
          nftMarketPlace = await nftMarketPlaceContract.connect(user);
          await basicNft.approve(user.address, TOKEN_ID);
          await expect(
            nftMarketPlace.listItem(basicNft.address, TOKEN_ID, PRICE)
          ).to.be.revertedWith("NftMarketplace__NotOwner");
        });
        it("updates the s_listings mapping with seller and price", async () => {
          nftMarketPlace.listItem(basicNft.address, TOKEN_ID, PRICE);
          const listing = await nftMarketPlace.getListing(
            basicNft.address,
            TOKEN_ID
          );

          await assert(listing.price.toString() == PRICE.toString());
          await assert(listing.seller.toString() == deployer.address);
        });
        it("makes sure that the same NFT isn't listed twice", async () => {
          // list the NFT once
          await nftMarketPlace.listItem(basicNft.address, TOKEN_ID, PRICE);
          const error = `NftMarketplace__AlreadyListed("${basicNft.address}", ${TOKEN_ID})`;
          // try listing the nft again, meant to revert
          // expect(await nftMarketPlace.listItem(basicNft.address, TOKEN_ID, PRICE)).to.be.revertedWithCustomError(error)
          await expect(
            nftMarketPlace.listItem(basicNft.address, TOKEN_ID, PRICE)
          ).to.be.revertedWith("NftMarketplace__AlreadyListed");
        });
      });

      //    cancel listing
      describe("CancelListing", () => {
        it("removes listing from the marketplace and emits an event", async () => {
          await nftMarketPlace.listItem(basicNft.address, TOKEN_ID, PRICE);

          expect(
            await nftMarketPlace.cancelListing(basicNft.address, TOKEN_ID)
          ).to.emit("ItemDeleted");
          const listing = await nftMarketPlace.getListing(
            basicNft.address,
            TOKEN_ID
          );
          assert.equal(listing.price.toString(), "0");
        });
        it("must be listed in the MP b4 it can be deleted", async () => {
          await expect(
            nftMarketPlace.cancelListing(basicNft.address, TOKEN_ID)
          ).to.be.revertedWith("NftMarketplace__NotListed");
        });
        it("only allows the owner of NFT to delete a listing", async () => {
          // List an NFT with the deployer's account
          await nftMarketPlace.listItem(basicNft.address, TOKEN_ID, PRICE);

          // Connect the marketplace contract to the user's account
          nftMarketPlace = await nftMarketPlaceContract.connect(user);

          // Approve the user to operate on the NFT
          await basicNft.approve(nftMarketPlace.address, TOKEN_ID);

          // Attempt to cancel the listing using the user's account
          // This should revert since the user is not the owner of the NFT
          await expect(
            nftMarketPlace.cancelListing(basicNft.address, TOKEN_ID)
          ).to.be.revertedWith("NftMarketplace__NotOwner");
        });
      });

      //   buy item
      describe("BuyItem", () => {
        it("allows payments and emits an event", async () => {
          // make sure an NFT is listed in the marketplace
          await nftMarketPlace.listItem(basicNft.address, TOKEN_ID, PRICE);

          // add a user and approve the NFT
          nftMarketPlace = await nftMarketPlaceContract.connect(user);
          await basicNft.approve(nftMarketPlace.address, TOKEN_ID);
          //   buy the nft
          const tx = await nftMarketPlace.buyItem(basicNft.address, TOKEN_ID, {
            value: PRICE,
          });
          // test
          await expect(tx).to.emit(nftMarketPlace, "ItemBought");
        });
        it("checks if it is listed b4 it can be bought", async () => {
          await expect(
            nftMarketPlace.buyItem(basicNft.address, TOKEN_ID)
          ).to.be.revertedWith("NftMarketplace__NotListed");
        });
        it("it deletes the NFT after it's bought", async () => {
          // make sure an NFT is listed in the marketplace
          await nftMarketPlace.listItem(basicNft.address, TOKEN_ID, PRICE);

          // add a user and approve the NFT
          nftMarketPlace = await nftMarketPlaceContract.connect(user);
          await basicNft.approve(nftMarketPlace.address, TOKEN_ID);
          //   buy the nft
          await nftMarketPlace.buyItem(basicNft.address, TOKEN_ID, {
            value: PRICE,
          });
          // check if the NFT is removed
          const listing = await nftMarketPlace.getListing(
            basicNft.address,
            TOKEN_ID
          );
          assert.equal(listing.price.toString(), "0");
        });
        it("makes sure the pay matches the price", async () => {
          const WRONG_PRICE = ethers.utils.parseEther("0.01");
          // make sure an NFT is listed in the marketplace
          await nftMarketPlace.listItem(basicNft.address, TOKEN_ID, PRICE);

          await expect(
            nftMarketPlace.buyItem(basicNft.address, TOKEN_ID, {
              value: WRONG_PRICE,
            })
          ).to.be.revertedWith("NftMarketplace__PriceNotMet");
        });
        it("Transfers proceeds to the owner", async () => {
          // make sure an NFT is listed in the marketplace
          await nftMarketPlace.listItem(basicNft.address, TOKEN_ID, PRICE);

          // get initial balance
          const deployerBalanceBefore = await deployer.getBalance();
          const sellerBalanceBefore = await user.getBalance();

          // add a user and approve the NFT
          nftMarketPlace = await nftMarketPlaceContract.connect(user);
          await basicNft.approve(nftMarketPlace.address, TOKEN_ID);

          //   buy the nft
          await nftMarketPlace.buyItem(basicNft.address, TOKEN_ID, {
            value: PRICE,
          });

          //   check new balances
          const deployerBalanceAfter = await deployer.getBalance();
          const sellerBalanceAfter = await user.getBalance();

          // check that they received the proceeds
          await assert(deployerBalanceAfter < deployerBalanceBefore);
          await assert(sellerBalanceAfter > sellerBalanceBefore);
        });
        it("updates the proceeds with each payment that is made", async () => {
          // make sure an NFT is listed in the marketplace
          await nftMarketPlace.listItem(basicNft.address, TOKEN_ID, PRICE);
          // get the initial seller proceeds
          const sellerInitialProceeds = await nftMarketPlace.getProceeds(
            deployer.address
          );

          // add a user and approve the NFT
          nftMarketPlace = await nftMarketPlaceContract.connect(user);
          await basicNft.approve(nftMarketPlace.address, TOKEN_ID);

          //   buy the nft
          await nftMarketPlace.buyItem(basicNft.address, TOKEN_ID, {
            value: PRICE,
          });

          //  check that the proceeds mapping was updated
          const newSellerProceeds = await nftMarketPlace.getProceeds(
            deployer.address
          );
          const newOwner = await basicNft.ownerOf(TOKEN_ID);
          //   test
          await assert(newSellerProceeds > sellerInitialProceeds);
          assert(newOwner.toString() == user.address);
        });
      });

      //   Test 3 => UpdateListing

      describe("UpdateListing", () => {
        it("checks if it is listed b4 it can be updated", async () => {
          const newPrice = ethers.utils.parseEther("1");
          await expect(
            nftMarketPlace.updateListing(basicNft.address, TOKEN_ID, newPrice)
          ).to.be.revertedWith("NftMarketplace__NotListed");
        });
        it("only allows the owner to update a listing", async () => {
          // have to list an NFT first
          await nftMarketPlace.listItem(basicNft.address, TOKEN_ID, PRICE);
          // connect a different account
          nftMarketPlace = await nftMarketPlaceContract.connect(user);
          // approve it
          await basicNft.approve(nftMarketPlace.address, TOKEN_ID);
          // call cancel func
          await expect(
            nftMarketPlace.updateListing(basicNft.address, TOKEN_ID, PRICE)
          ).to.be.revertedWith("NftMarketplace__NotOwner");
        });

        it("emits an event when a listing is updated & updates the price of the item", async () => {
          const newPrice = ethers.utils.parseEther("1");
          // have to list an NFT first
          await nftMarketPlace.listItem(basicNft.address, TOKEN_ID, PRICE);

          expect(
            await nftMarketPlace.updateListing(
              basicNft.address,
              TOKEN_ID,
              newPrice
            )
          ).to.emit("ItemListed");
          const listing = await nftMarketPlace.getListing(
            basicNft.address,
            TOKEN_ID
          );
          assert.equal(listing.price.toString(), newPrice.toString());
        });
      });
      // test 4 => withdraw proceeds
      describe("withdrawProceeds", function () {
        it("doesn't allow 0 proceed withdrawals", async function () {
          await expect(nftMarketPlace.withdrawProceeds()).to.be.revertedWith(
            "NftMarketplace__NoProceeds"
          );
        });
        it("withdraws proceeds", async function () {
          await nftMarketPlace.listItem(basicNft.address, TOKEN_ID, PRICE);
          nftMarketPlace = nftMarketPlaceContract.connect(user);
          await nftMarketPlace.buyItem(basicNft.address, TOKEN_ID, {
            value: PRICE,
          });
          nftMarketPlace = nftMarketPlaceContract.connect(deployer);

          const deployerProceedsBefore = await nftMarketPlace.getProceeds(
            deployer.address
          );
          const deployerBalanceBefore = await deployer.getBalance();
          const txResponse = await nftMarketPlace.withdrawProceeds();
          const transactionReceipt = await txResponse.wait(1);
          const { gasUsed, effectiveGasPrice } = transactionReceipt;
          const gasCost = gasUsed.mul(effectiveGasPrice);
          const deployerBalanceAfter = await deployer.getBalance();

          assert(
            deployerBalanceAfter.add(gasCost).toString() ==
              deployerProceedsBefore.add(deployerBalanceBefore).toString()
          );
        });
      });
    });
