const TRAY_TEXT = {
  en: {
    characters: "Characters",
    managePets: "Manage Pets",
    hidePet: "Hide Pet",
    showPet: "Show Pet",
    resetPosition: "Reset Position",
    pausePet: "Pause Pet",
    resumePet: "Resume Pet",
    behavior: "Behavior",
    defaultBehavior: "Default",
    size: "Size",
    large: "Large",
    defaultSize: "Default",
    small: "Small",
    alwaysOnTop: "Always On Top",
    autoMotion: "Auto Motion",
    autoMotionTip: "Only runs when Behavior is Default.",
    launchAtLogin: "Launch at Login",
    quit: "Quit",
    states: {
      idle: "Relax",
      "running-right": "Walk Right",
      "running-left": "Walk Left",
      waving: "Greeting",
      jumping: "Jump",
      failed: "Oops",
      waiting: "Waiting",
      running: "Active",
      review: "Thinking"
    }
  },
  "zh-CN": {
    characters: "宠物",
    managePets: "管理宠物",
    hidePet: "隐藏宠物",
    showPet: "显示宠物",
    resetPosition: "重置位置",
    pausePet: "暂停宠物",
    resumePet: "恢复宠物",
    behavior: "行为",
    defaultBehavior: "默认",
    size: "大小",
    large: "大",
    defaultSize: "默认",
    small: "小",
    alwaysOnTop: "置顶显示",
    autoMotion: "自动移动",
    autoMotionTip: "仅在行为为默认时生效。",
    launchAtLogin: "开机启动",
    quit: "退出",
    states: {
      idle: "放松",
      "running-right": "向右走",
      "running-left": "向左走",
      waving: "打招呼",
      jumping: "跳跃",
      failed: "失败",
      waiting: "等待",
      running: "活跃",
      review: "思考"
    }
  }
};

function getTrayText(language) {
  return TRAY_TEXT[language] ?? TRAY_TEXT.en;
}

function behaviorStateLabel(state, text) {
  return text.states[state] ?? state;
}

function buildTrayMenuTemplate({
  behaviorMode,
  behaviorMenuStates,
  autonomousWalkEnabled,
  mainWindow,
  onCharacterSelect,
  onManageCharacters,
  onLockBehavior,
  onResetPosition,
  onSetAutoBehavior,
  onSetSizeMode,
  onToggleLaunchAtLogin,
  onTogglePetPaused,
  onTogglePetVisibility,
  onToggleAutonomousWalk,
  onToggleAlwaysOnTop,
  onQuit,
  readCharacters,
  language,
  launchAtLogin,
  petPaused,
  selectedCharacterId,
  sizeMode
}) {
  const characters = readCharacters();
  const text = getTrayText(language);

  return [
    {
      label: text.characters,
      submenu: [
        {
          label: text.managePets,
          click: () => onManageCharacters()
        },
        { type: "separator" },
        ...characters.map((character) => ({
          label: character.name,
          type: "radio",
          checked: character.id === selectedCharacterId,
          click: () => onCharacterSelect(character.id)
        }))
      ]
    },
    { type: "separator" },
    {
      label: mainWindow?.isVisible() ? text.hidePet : text.showPet,
      click: () => onTogglePetVisibility()
    },
    {
      label: text.resetPosition,
      click: () => onResetPosition()
    },
    {
      label: petPaused ? text.resumePet : text.pausePet,
      click: () => onTogglePetPaused()
    },
    {
      label: text.behavior,
      submenu: [
        {
          label: text.defaultBehavior,
          type: "radio",
          checked: behaviorMode.type === "auto",
          click: () => onSetAutoBehavior()
        },
        { type: "separator" },
        ...behaviorMenuStates.map((state) => ({
          label: behaviorStateLabel(state, text),
          type: "radio",
          checked: behaviorMode.type === "locked" && behaviorMode.state === state,
          click: () => onLockBehavior(state)
        }))
      ]
    },
    {
      label: text.size,
      submenu: [
        {
          label: text.large,
          type: "radio",
          checked: sizeMode === "large",
          click: () => onSetSizeMode("large")
        },
        {
          label: text.defaultSize,
          type: "radio",
          checked: sizeMode === "default",
          click: () => onSetSizeMode("default")
        },
        {
          label: text.small,
          type: "radio",
          checked: sizeMode === "small",
          click: () => onSetSizeMode("small")
        }
      ]
    },
    {
      label: text.alwaysOnTop,
      type: "checkbox",
      checked: mainWindow ? mainWindow.isAlwaysOnTop() : true,
      click: () => onToggleAlwaysOnTop()
    },
    {
      label: text.autoMotion,
      type: "checkbox",
      checked: autonomousWalkEnabled,
      toolTip: text.autoMotionTip,
      click: () => onToggleAutonomousWalk()
    },
    {
      label: text.launchAtLogin,
      type: "checkbox",
      checked: launchAtLogin,
      click: () => onToggleLaunchAtLogin()
    },
    { type: "separator" },
    {
      label: text.quit,
      click: () => onQuit()
    }
  ];
}

module.exports = {
  buildTrayMenuTemplate
};
