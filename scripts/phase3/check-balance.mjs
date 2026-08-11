import { ethers } from "ethers";
import "dotenv/config";

const provider = new ethers.JsonRpcProvider(process.env.COSTON2_RPC_URL);
const registry = new ethers.Contract(
  "0xaD67FE66660Fb8dFE9d6b1b4240d8650e30F6019",
  ["function getContractAddressByName(string) view returns (address)"],
  provider
);
const assetManagerAddress = await registry.getContractAddressByName("AssetManagerFXRP");
const assetManager = new ethers.Contract(assetManagerAddress, ["function fAsset() view returns (address)", "function lotSize() view returns (uint256)"], provider);
const fxrpAddress = await assetManager.fAsset();
const lotSize = await assetManager.lotSize();
const fxrp = new ethers.Contract(fxrpAddress, ["function balanceOf(address) view returns (uint256)"], provider);

const bal = await fxrp.balanceOf(process.env.ESCROW_DEPLOYER_ADDRESS);
console.log("ESCROW_DEPLOYER_ADDRESS:", process.env.ESCROW_DEPLOYER_ADDRESS);
console.log("FXRP balance (UBA):", bal.toString());
console.log("FXRP balance (XRP):", ethers.formatUnits(bal, 6));
console.log("lotSize (UBA):", lotSize.toString());
console.log("lots available:", bal / lotSize);
