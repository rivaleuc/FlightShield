// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title InsurancePool — collects premiums and pays flight delay claims
/// @notice Minimal Remix-deployable contract. Resolver reads GenLayer
///         and triggers payout. Pool funded by anyone (LPs).
contract InsurancePool {
    address public owner;
    address public resolver;
    uint256 public premiumRate;  // in basis points of payout (e.g. 500 = 5%)
    uint256 public totalPremiums;
    uint256 public totalPayouts;

    mapping(uint256 => bool) public claimed;

    event PremiumPaid(address indexed holder, uint256 amount);
    event ClaimPaid(uint256 indexed policyKey, address indexed holder, uint256 amount);
    event PoolFunded(address indexed funder, uint256 amount);

    modifier onlyResolver() { require(msg.sender == resolver, "!resolver"); _; }
    modifier onlyOwner() { require(msg.sender == owner, "!owner"); _; }

    constructor(address _resolver, uint256 _premiumRate) {
        owner = msg.sender;
        resolver = _resolver;
        premiumRate = _premiumRate;
    }

    /// @notice Anyone can fund the insurance pool.
    function fund() external payable {
        emit PoolFunded(msg.sender, msg.value);
    }

    /// @notice Policy holder pays premium when buying coverage.
    function payPremium() external payable {
        require(msg.value > 0, "no premium");
        totalPremiums += msg.value;
        emit PremiumPaid(msg.sender, msg.value);
    }

    /// @notice Resolver triggers payout after GenLayer confirms delay.
    function payout(uint256 policyKey, address holder, uint256 amount) external onlyResolver {
        require(!claimed[policyKey], "already claimed");
        require(address(this).balance >= amount, "pool underfunded");
        claimed[policyKey] = true;
        totalPayouts += amount;
        payable(holder).transfer(amount);
        emit ClaimPaid(policyKey, holder, amount);
    }

    function setResolver(address _r) external onlyOwner { resolver = _r; }
    function poolBalance() external view returns (uint256) { return address(this).balance; }

    receive() external payable {}
}
