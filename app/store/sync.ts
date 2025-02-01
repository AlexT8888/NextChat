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
        // 获取云端数据（使用实际用户名）
        const remoteState = await client.get(cloudUsername);
        
        if (!remoteState || remoteState === "") {
          // 云端无数据时上传本地数据
          await client.set(cloudUsername, JSON.stringify(localState));
          console.log("[Sync] Remote state is empty, using local state instead.");
          return;
        } else {
          const parsedRemoteState = JSON.parse(remoteState) as AppState;
    
          if (isKKKUser) {
            // KKK用户处理流程
            // 1. 创建本地状态拷贝
            const mergedState = JSON.parse(JSON.stringify(localState));
            // 2. 合并云端数据到拷贝
            mergeAppState(mergedState, parsedRemoteState);
            // 3. 上传合并后的状态到云端（不修改本地）
            await client.set(cloudUsername, JSON.stringify(mergedState));
          } else {
            // 非KKK用户处理流程
            // 1. 完全使用云端状态覆盖本地
            setLocalAppState(parsedRemoteState);
            // 2. 上传最新的本地状态（即刚设置的云端数据）
            await client.set(cloudUsername, JSON.stringify(parsedRemoteState));
          }
          
          // 标记同步时间
          this.markSyncTime();
        }
      } catch (e) {
        console.log("[Sync] Failed to sync with remote state", e);
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
