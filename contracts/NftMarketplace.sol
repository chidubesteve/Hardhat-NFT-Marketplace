// SPDX-License-Identifier: MIT

// imports
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

// errors
error NftMarketplace__PriceMustBeAboveZero();
error NftMarketplace__NotApprovedForMarketPlace();
error NftMarketplace__AlreadyListed(address nftAddress, uint256 tokenId);
error NftMarketplace__NotOwner();
error NftMarketplace__NotListed(address nftAddress, uint256 tokenId);
error NftMarketplace__PriceNotMet(
  address nftAddress,
  uint256 tokenId,
  uint256 price
);
error NftMarketplace__NoProceeds();
error NftMarketplace__TransferFailed();

pragma solidity ^0.8.9;

contract NftMarketplace is ReentrancyGuard {
  struct Listing {
    uint256 price;
    address seller;
  }

  // Events
  event ItemListed(
    address indexed seller,
    address indexed nftAddress,
    uint256 indexed tokenId,
    uint256 price
  );
  event ItemBought(
    address indexed nftAddress,
    address indexed buyer,
    uint256 tokenId,
    uint256 price
  );
  event ItemDeleted(
    address indexed seller,
    address indexed nftAddress,
    uint256 indexed tokenId
  );

  // Mappings
  //   Nft contrcat address -> tokenId's -> Listing
  mapping(address => mapping(uint256 => Listing)) private s_listings;

  // seller address -> Amount earned
  mapping(address => uint256) public s_proceeds;

  // Modifiers
  modifier notListed(
    address nftAddress,
    uint256 tokenId
  ) {
    Listing memory listing = s_listings[nftAddress][tokenId];
    if (listing.price > 0) {
      revert NftMarketplace__AlreadyListed(nftAddress, tokenId);
    }
    _;
  }

  modifier isListed(address nftAddress, uint256 tokenId) {
    Listing memory listing = s_listings[nftAddress][tokenId];
    if (listing.price <= 0) {
      revert NftMarketplace__NotListed(nftAddress, tokenId);
    }
    _;
  }

  modifier isOwner(
    address nftAddress,
    uint256 tokenId,
    address spender
  ) {
    IERC721 nft = IERC721(nftAddress);
    address owner = nft.ownerOf(tokenId);
    if (spender != owner) {
      revert NftMarketplace__NotOwner();
    }
    _;
  }

  // Main Functions

  /*
   *@notice Method for listing NFT's in the marketplace
   * @param nftAddress: address of the nft
   * @param tokenId: the token Id of the NFT
   * @param price: the sale Price of the NFT
   * @dev this way the people can hold their NFt and give permission to the marketplace to sell or list it
   */
  function listItem(
    address nftAddress,
    uint256 tokenId,
    uint256 price
  )
    external
    notListed(nftAddress, tokenId)
    isOwner(nftAddress, tokenId, msg.sender)
  {
    if (price <= 0) {
      revert NftMarketplace__PriceMustBeAboveZero();
    }
    IERC721 nft = IERC721(nftAddress);
    if (nft.getApproved(tokenId) != address(this)) {
      revert NftMarketplace__NotApprovedForMarketPlace();
    }
    s_listings[nftAddress][tokenId] = Listing(price, msg.sender);
    emit ItemListed(msg.sender, nftAddress, tokenId, price);
  }

  // Buy NFT function
  /// @notice you can buy NFT with the call of the
  /// function
  /// @dev This method is used to buy an NFT, it reverts with an error if the price is not met, it emits an ItemBought event. The method uses the OpenZeppelin nonReentrant function to prevent the reentrancy attack
  /// @param nftAddress: the address of the NFT
  /// @param tokenId: the tokenId of the NFT
  function buyItem(
    address nftAddress,
    uint256 tokenId
  ) external payable nonReentrant isListed(nftAddress, tokenId) {
    Listing memory listedItem = s_listings[nftAddress][tokenId];
    if (msg.value < listedItem.price) {
      revert NftMarketplace__PriceNotMet(nftAddress, tokenId, listedItem.price);
    }
    s_proceeds[listedItem.seller] += msg.value;
    delete s_listings[nftAddress][tokenId];
    IERC721(nftAddress).safeTransferFrom(listedItem.seller, msg.sender, tokenId);
    emit ItemBought(nftAddress, msg.sender, tokenId, listedItem.price);
  }

  /// @notice this is the method to cancel a listing from the marketplace
  /// @dev It checks if the account calling the function is the owner of the NFT and then if the NFT is listed in the Marketplace and then deletes the NFT from the listing
  /// @param nftAddress: the address of the NFT
  /// @param tokenId: the tokenId of the NFT
  function cancelListing(
    address nftAddress,
    uint256 tokenId
  )
    external
    isOwner(nftAddress, tokenId, msg.sender)
    isListed(nftAddress, tokenId)
  {
    delete s_listings[nftAddress][tokenId];
    emit ItemDeleted(msg.sender, nftAddress, tokenId);
  }

  /// @notice this is the method to update an already existing listing in the marketplace
  /// @dev It checks if the account calling the function is the owner of the NFT and then if the NFT is listed in the Marketplace and then updates the price
  /// @param nftAddress: the address of the NFT
  /// @param tokenId: the tokenId of the NFT
  /// @param newPrice: the new price of the NFT if the old price is changed during the updating
  function updateListing(
    address nftAddress,
    uint256 tokenId,
    uint256 newPrice
  )
    external
    isListed(nftAddress, tokenId)
    isOwner(nftAddress, tokenId, msg.sender)
  {
    s_listings[nftAddress][tokenId].price = newPrice;
    emit ItemListed(msg.sender, nftAddress, tokenId, newPrice);
  }

  function withdrawProceeds() external {
    uint256 proceeds = s_proceeds[msg.sender];
    if (proceeds <= 0) {
      revert NftMarketplace__NoProceeds();
    }
    s_proceeds[msg.sender] = 0;
    (bool success, ) = payable(msg.sender).call{ value: proceeds }("");
    if (!success) {
      revert NftMarketplace__TransferFailed();
    }
  }

  //   GETTER FUNCTIONS

  function getListing(
    address nftAddress,
    uint256 tokenId
  ) external view returns (Listing memory) {
    return s_listings[nftAddress][tokenId];
  }

  function getProceeds(address seller) external view returns (uint256) {
    return s_proceeds[seller];
  }
}
