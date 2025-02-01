import { getClientConfig } from "../config/client";
import { ApiPath, STORAGE_KEY, StoreKey } from "../constant";
import { createPersistStore } from "../utils/store";
import {
  AppState,
  getLocalAppState,
  GetStoreState,
  mergeAppState,
  setLocalAppState,
} from "../utils/sync";
import { downloadAs, readFromFile } from "../utils";
import { showToast } from "../components/ui-lib";
import Locale from "../locales";
import { createSyncClient, ProviderType } from "../utils/cloud";

export interface WebDavConfig {
  server: string;
  username: string;
  password: string;
}

const isApp = !!getClientConfig()?.isApp;
export type SyncStore = GetStoreState<typeof useSyncStore>;

const DEFAULT_SYNC_STATE = {
  provider: ProviderType.WebDAV,
  useProxy: true,
  proxyUrl: ApiPath.Cors as string,

  webdav: {
    endpoint: "",
    username: "",
    password: "",
  },

  upstash: {
    endpoint: "",
    username: STORAGE_KEY,
    apiKey: "",
  },

  lastSyncTime: 0,
  lastProvider: "",
};

export const useSyncStore = createPersistStore(
  DEFAULT_SYNC_STATE,
  (set, get) => ({
    cloudSync() {
      const config = get()[get().provider];
      return Object.values(config).every((c) => c.toString().length > 0);
    },

    markSyncTime() {
      set({ lastSyncTime: Date.now(), lastProvider: get().provider });
    },

    export() {
      const state = getLocalAppState();
      const datePart = isApp
        ? `${new Date().toLocaleDateString().replace(/\//g, "_")} ${new Date()
            .toLocaleTimeString()
            .replace(/:/g, "_")}`
        : new Date().toLocaleString();

      const fileName = `Backup-${datePart}.json`;
      downloadAs(JSON.stringify(state), fileName);
    },

    async import() {
      const rawContent = await readFromFile();

      try {
        const remoteState = JSON.parse(rawContent) as AppState;
        const localState = getLocalAppState();
        mergeAppState(localState, remoteState);
        setLocalAppState(localState);
        location.reload();
      } catch (e) {
        console.error("[Import]", e);
        showToast(Locale.Settings.Sync.ImportFailed);
      }
    },

    getClient() {
      const provider = get().provider;
      const client = createSyncClient(provider, get());
      return client;
    },

    async sync() {
      const localState = getLocalAppState();
      const provider = get().provider;
      const config = get()[provider];
      const client = this.getClient();
      const username = config.username;
    
      // 判断是否是KKK开头用户
      const isKKKUser = username.startsWith("KKK");
      // 云端实际使用用户名（KKK用户去掉前3个字符）
      const cloudUsername = isKKKUser ? username.slice(3) : username;
    
      try {
        // 获取云端时使用映射后的用户名
        const remoteState = await client.get(cloudUsername);
        
        if (!remoteState || remoteState === "") {
          // 初始化同步时也使用映射后的用户名
          await client.set(cloudUsername, JSON.stringify(localState));
          console.log("[Sync] Init cloud state with:", cloudUsername);
          return;
        } else {
          const parsedRemoteState = JSON.parse(remoteState) as AppState;
    
          if (isKKKUser) {
            // 深拷贝本地状态时需要使用结构化克隆
            const mergedState = structuredClone(localState); 
            console.log("Before merge - local:", localState, "remote:", parsedRemoteState);
            
            // 合并方向需要特别注意：本地副本保留，云端数据优先
            mergeAppState(mergedState, parsedRemoteState); 
            console.log("After merge:", mergedState);
    
            // 确保使用映射后的用户名上传
            await client.set(cloudUsername, JSON.stringify(mergedState));
            console.log("[Sync] Merged state uploaded to:", cloudUsername);
          } else {
            // 覆盖本地后需要刷新页面
            console.log("Overriding local state with remote:", parsedRemoteState);
            setLocalAppState(parsedRemoteState);
            await client.set(cloudUsername, JSON.stringify(parsedRemoteState));
            location.reload(); // 确保界面刷新
          }
          
          this.markSyncTime();
          
          // 验证同步后的云端状态
          const verifyState = await client.get(cloudUsername);
          console.log("Post-sync cloud state:", JSON.parse(verifyState));
        }
      } catch (e) {
        console.error("[Sync Error]", e);
        throw e;
      }
    },


    async check() {
      const client = this.getClient();
      return await client.check();
    },
  }),
  {
    name: StoreKey.Sync,
    version: 1.2,

    migrate(persistedState, version) {
      const newState = persistedState as typeof DEFAULT_SYNC_STATE;

      if (version < 1.1) {
        newState.upstash.username = STORAGE_KEY;
      }

      if (version < 1.2) {
        if (
          (persistedState as typeof DEFAULT_SYNC_STATE).proxyUrl ===
          "/api/cors/"
        ) {
          newState.proxyUrl = "";
        }
      }

      return newState as any;
    },
  },
);
