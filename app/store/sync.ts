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
    
      // [+] 新增部分：处理用户名
      const isKKKCase = config.username.startsWith("KKK");
      const realUsername = isKKKCase ? 
        config.username.replace(/^KKK/, "") : // 删除开头的KKK
        config.username;
    
      try {
        // [!] 修改点：使用处理后的用户名获取数据
        let remoteState = await client.get(realUsername);
    
        if (isKKKCase) {
          // [+] KKK专属逻辑：云端副本合并本地后上传
          if (!remoteState) {
            await client.set(realUsername, JSON.stringify(localState));
            console.log("[Sync][KKK] Upload local state to new cloud");
          } else {
            // [!] 深拷贝远程状态避免污染原始数据
            const remoteCopy: AppState = JSON.parse(remoteState);
            
            // [!] 将本地合并到云端副本（第一个参数会被修改）
            mergeAppState(remoteCopy, localState);
            
            // [!] 上传合并后的云状态
            await client.set(realUsername, JSON.stringify(remoteCopy));
            console.log("[Sync][KKK] Merged local data into cloud");
          }
          
        } else {
          // [-] 原有逻辑保持不变
          if (!remoteState || remoteState === "") {
            await client.set(realUsername, JSON.stringify(localState));
            console.log("[Sync] Remote state is empty, using local state");
          } else {
            const parsedRemoteState = JSON.parse(remoteState) as AppState;
            mergeAppState(localState, parsedRemoteState);
            setLocalAppState(localState);
            await client.set(realUsername, JSON.stringify(localState));
          }
        }
    
        this.markSyncTime();
      } catch (e) {
        console.error("[Sync] failed", e);
        throw e;
      }
    }


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
