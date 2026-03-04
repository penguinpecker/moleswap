import EthereumProvider from "@walletconnect/ethereum-provider";

let provider: EthereumProvider | null = null;

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "";

export async function getWalletConnectProvider() {
  if (!provider) {
    provider = await EthereumProvider.init({
      projectId,
      showQrModal: true,
      metadata: {
        name: "Swap Surge Play",
        description: "Game dApp wallet connection",
        url: "https://example.com",
        icons: ["https://avatars.githubusercontent.com/u/37784886"],
      },
      chains: [1],
      optionalChains: [137, 42161, 10, 8453, 56],
      methods: [
        "eth_sendTransaction",
        "eth_sign",
        "personal_sign",
        "eth_signTypedData",
      ],
      events: ["accountsChanged", "chainChanged"],
      qrModalOptions: {
        themeMode: "dark",
      },
    });
  }
  return provider;
}

export async function connectWithWalletConnect(): Promise<string[]> {
  const p = await getWalletConnectProvider();
  const accounts = (await p.enable()) as string[];
  return accounts;
}

export async function disconnectWalletConnect() {
  const p = await getWalletConnectProvider();
  await p.disconnect();
}
