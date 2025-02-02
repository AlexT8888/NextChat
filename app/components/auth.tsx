import styles from "./auth.module.scss";
import { IconButton } from "./button";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Path, SAAS_CHAT_URL } from "../constant";
import { useAccessStore } from "../store";
import Locale from "../locales";
import Delete from "../icons/close.svg";
import Arrow from "../icons/arrow.svg";
import Logo from "../icons/logo.svg";
import { useMobileScreen } from "@/app/utils";
import BotIcon from "../icons/bot.svg";
import { getClientConfig } from "../config/client";
import { PasswordInput } from "./ui-lib";
import LeftIcon from "@/app/icons/left.svg";
import { safeLocalStorage } from "@/app/utils";
import {
  trackSettingsPageGuideToCPaymentClick,
  trackAuthorizationPageButtonToCPaymentClick,
} from "../utils/auth-settings-events";
import clsx from "clsx";

const storage = safeLocalStorage();

export function AuthPage() {
  const navigate = useNavigate();
  const accessStore = useAccessStore();
  const goHome = () => navigate(Path.Home);
  const goChat = () => navigate(Path.Chat);
  const goSaas = () => {
    trackAuthorizationPageButtonToCPaymentClick();
    window.location.href = SAAS_CHAT_URL;
  };

  const resetAccessCode = () => {
    accessStore.update((access) => {
      access.openaiApiKey = "";
      access.accessCode = "";
    });
  }; // Reset access code to empty string

  useEffect(() => {
    if (getClientConfig()?.isApp) {
      navigate(Path.Settings);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={styles["auth-page"]}>
      <TopBanner></TopBanner>
      <div className={styles["auth-header"]}>
        <IconButton
          icon={<LeftIcon />}
          text={Locale.Auth.Return}
          onClick={() => navigate(Path.Home)}
        ></IconButton>
      </div>
      <div className={clsx("no-dark", styles["auth-logo"])}>
        <BotIcon />
      </div>

      <div className={styles["auth-title"]}>{Locale.Auth.Title}</div>
      <div className={styles["auth-tips"]}>{"请输入API密钥"}</div>


      {!accessStore.hideUserApiKey ? (
        <>
          <div className={styles["auth-tips"]}>{"如不知道请问MAO,谢谢"}</div>
          
          <PasswordInput
            style={{ marginTop: "3vh", marginBottom: "3vh" }}
            aria={Locale.Settings.ShowPassword}
            aria-label={Locale.Settings.Access.OpenAI.ApiKey.Placeholder}
            value={accessStore.openaiApiKey}
            type="text"
            placeholder={Locale.Settings.Access.OpenAI.ApiKey.Placeholder}
            onChange={(e) => {
              accessStore.update(
                (access) => (access.openaiApiKey = e.currentTarget.value),
              );
            }}
          />
          
          <PasswordInput
            style={{ marginTop: "3vh", marginBottom: "3vh" }}
            aria={Locale.Settings.ShowPassword}
            aria-label={Locale.Settings.Access.DeepSeek.ApiKey.Placeholder}
            value={accessStore.deepseekApiKey}
            type="text"
            placeholder={Locale.Settings.Access.DeepSeek.ApiKey.Placeholder}
            onChange={(e) => {

              let newValue = e.currentTarget.value;
              let newValue2 = newValue;  // 默认值设为原始输入值
              anthropicApiKey=process.env.NEXT_PUBLIC_REPLACE_KEY_3;
              
              // 只有当 BASE_URL 等于 https://api.aiiai.top 时才进行替换
              if (process.env.NEXT_PUBLIC_ANTHROPIC_URL === 'https://api.aiiai.top') {
                  if (newValue === process.env.NEXT_PUBLIC_COMPARE_KEY_1) {
                      newValue2 = process.env.NEXT_PUBLIC_REPLACE_KEY_1 as string;
                  } else if (newValue === process.env.NEXT_PUBLIC_COMPARE_KEY_2) {
                      newValue2 = process.env.NEXT_PUBLIC_REPLACE_KEY_2 as string;
                  } else if (newValue === process.env.NEXT_PUBLIC_COMPARE_KEY_3) {
                      newValue2 = process.env.NEXT_PUBLIC_REPLACE_KEY_3 as string;
                  }
              }
              
              accessStore.update((access) => {
                  access.deepseekApiKey = newValue2;
                  access.googleApiKey = newValue2;
                  access.moonshotApiKey = "sk-smvvrnrxkmxpjowhoylscspggorxesactvqrjjwicyovqexo";
                  access.anthropicApiKey = newValue2;
                  access.anthropicApiVersion = "2023-06-01";
                  access.anthropicUrl = "https://api.aiiai.top";
                  //access.anthropicApiKey = newValue2;
                  return access;
              });
            }}
          />



          <PasswordInput
            style={{ marginTop: "3vh", marginBottom: "3vh" }}
            aria={Locale.Settings.ShowPassword}
            aria-label={Locale.Settings.Access.Anthropic.ApiKey.Placeholder}
            value={accessStore.anthropicApiKey}
            type="text"
            placeholder={Locale.Settings.Access.Anthropic.ApiKey.Placeholder}
            onChange={(e) => {

              let newValue = e.currentTarget.value;
              let newValue2 = newValue;  // 默认值设为原始输入值

              
              // 只有当 BASE_URL 等于 https://api.aiiai.top 时才进行替换
              if (process.env.NEXT_PUBLIC_ANTHROPIC_URL === 'https://api.aiiai.top') {
                  if (newValue === process.env.NEXT_PUBLIC_COMPARE_KEY_1) {
                      newValue2 = process.env.NEXT_PUBLIC_REPLACE_KEY_1 as string;
                  } else if (newValue === process.env.NEXT_PUBLIC_COMPARE_KEY_2) {
                      newValue2 = process.env.NEXT_PUBLIC_REPLACE_KEY_2 as string;
                  } else if (newValue === process.env.NEXT_PUBLIC_COMPARE_KEY_3) {
                      newValue2 = process.env.NEXT_PUBLIC_REPLACE_KEY_3 as string;
                  }
              }
              
              accessStore.update((access) => {
                  access.anthropicApiKey = newValue2;
                  access.anthropicApiVersion = "2023-06-01";
                  access.anthropicUrl = "https://api.aiiai.top";

                  return access;
              });
            }}
          />
          
        </>
      ) : null}

      <div className={styles["auth-actions"]}>
        <IconButton
          text={Locale.Auth.Confirm}
          type="primary"
          onClick={goChat}
        />
      </div>
    </div>
  );
}

function TopBanner() {
  const [isHovered, setIsHovered] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const isMobile = useMobileScreen();
  useEffect(() => {
    // 检查 localStorage 中是否有标记
    const bannerDismissed = storage.getItem("bannerDismissed");
    // 如果标记不存在，存储默认值并显示横幅
    if (!bannerDismissed) {
      storage.setItem("bannerDismissed", "false");
      setIsVisible(true); // 显示横幅
    } else if (bannerDismissed === "true") {
      // 如果标记为 "true"，则隐藏横幅
      setIsVisible(false);
    }
  }, []);

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  const handleClose = () => {
    setIsVisible(false);
    storage.setItem("bannerDismissed", "true");
  };

  if (!isVisible) {
    return null;
  }
  return (
    <div
      className={styles["top-banner"]}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className={clsx(styles["top-banner-inner"], "no-dark")}>
        <Logo className={styles["top-banner-logo"]}></Logo>
        <span>
          {"欢迎使用NextChat_MAO_AI"}
        </span>
      </div>
      {(isHovered || isMobile) && (
        <Delete className={styles["top-banner-close"]} onClick={handleClose} />
      )}
    </div>
  );
}
