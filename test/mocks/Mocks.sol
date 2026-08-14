// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Minimal ERC20 standing in for FXRP. Only the three methods
/// WardenEscrow actually calls are implemented, plus a switch to make
/// transferFrom report failure by returning false rather than reverting —
/// the case WardenEscrow's `require(ok, ...)` exists to catch.
contract MockFXRP {
    string public constant name = "Mock FXRP";
    string public constant symbol = "FXRP";
    uint8 public constant decimals = 6; // same scale as XRP drops / FAssets UBA

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    bool public transferFromReturnsFalse;

    function setTransferFromReturnsFalse(bool value) external {
        transferFromReturnsFalse = value;
    }

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function burnFrom(address from, uint256 amount) external {
        require(balanceOf[from] >= amount, "burn exceeds balance");
        balanceOf[from] -= amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "insufficient balance");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        if (transferFromReturnsFalse) {
            return false;
        }
        require(allowance[from][msg.sender] >= amount, "insufficient allowance");
        require(balanceOf[from] >= amount, "insufficient balance");
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

/// @notice Stands in for the FAssets AssetManager. Real `redeem()` burns the
/// caller's FXRP and schedules an XRPL payout by an agent; this mock burns the
/// caller's balance so `heldBalance()` assertions stay meaningful, and records
/// the arguments so tests can prove the escrow forwarded the right lot count
/// and XRPL address.
contract MockAssetManager {
    MockFXRP public immutable fxrp;
    uint256 public lotSizeUBA;

    uint256 public lastLots;
    string public lastRedeemerAddress;
    address public lastExecutor;
    uint256 public redeemCallCount;

    constructor(MockFXRP _fxrp, uint256 _lotSizeUBA) {
        fxrp = _fxrp;
        lotSizeUBA = _lotSizeUBA;
    }

    function setLotSize(uint256 _lotSizeUBA) external {
        lotSizeUBA = _lotSizeUBA;
    }

    function lotSize() external view returns (uint256) {
        return lotSizeUBA;
    }

    function redeem(
        uint256 _lots,
        string memory _redeemerUnderlyingAddressString,
        address payable _executor
    ) external payable returns (uint256 _redeemedAmountUBA) {
        lastLots = _lots;
        lastRedeemerAddress = _redeemerUnderlyingAddressString;
        lastExecutor = _executor;
        redeemCallCount++;

        _redeemedAmountUBA = _lots * lotSizeUBA;
        fxrp.burnFrom(msg.sender, _redeemedAmountUBA);
    }
}

/// @notice Stands in for Flare's FlareTeeManager diamond. Returns whatever
/// public key / extension id a test registers for a given teeId, so tests can
/// model an unregistered TEE, a TEE belonging to somebody else's extension, or
/// the real registered one.
contract MockMachineManager {
    mapping(address => bytes32) public pubKeyX;
    mapping(address => bytes32) public pubKeyY;
    mapping(address => uint256) public extensionIdOf;

    function register(address teeId, bytes32 x, bytes32 y, uint256 extensionId) external {
        pubKeyX[teeId] = x;
        pubKeyY[teeId] = y;
        extensionIdOf[teeId] = extensionId;
    }

    function getPublicKey(address _teeId) external view returns (bytes32 x, bytes32 y) {
        return (pubKeyX[_teeId], pubKeyY[_teeId]);
    }

    function getExtensionId(address _teeId) external view returns (uint256) {
        return extensionIdOf[_teeId];
    }
}
