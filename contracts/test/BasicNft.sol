// SPDX-License-Identifier: MIT
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

pragma solidity ^0.8.9;

contract BasicNft is ERC721 {
  string public constant TOKEN_URI =
    "ipfs://bafybeig37ioir76s7mg5oobetncojcm3c3hxasyd4rvid4jqhy4gkaheg4/?filename=0-PUG.json";

  uint256 private s_tokenCounter;
  // events
  event DogMinted(uint256 indexed tokenId);

  constructor() ERC721("Dogie", "DOG") {
    s_tokenCounter = 0;
  }

  // mint the nft token
  function mintNft() public {
    _safeMint(msg.sender, s_tokenCounter);
    emit DogMinted(s_tokenCounter);
    s_tokenCounter = s_tokenCounter + 1;
  }

  // Get the token URI for a given tokenId
  function getTokenURI(uint256 tokenId) public view returns (string memory) {
    require(_exists(tokenId), "URI query for nonexistent token");
    return TOKEN_URI;
  }

  function getTokenCounter() public view returns (uint256) {
    return s_tokenCounter;
  }
}