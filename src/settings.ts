import { App, PluginSettingTab, Setting } from 'obsidian';
import PayloadPlugin from './main';

export interface GlobalVariable {
    key: string;
    value: string;
}

export interface FileBinding {
    id: string;
    mdPath: string;
    txtPath: string;
    enabled: boolean;
}

export interface PayloadSettings {
    customColor: string;
    useCustomColor: boolean;
    languages: string[];
    globalVariablesList: GlobalVariable[];
    fileBindings: FileBinding[];
}

export const DEFAULT_SETTINGS: PayloadSettings = {
    customColor: '#086ddd',
    useCustomColor: false,
    languages: ['plaintext', 'bash', 'shell', 'python', 'java', 'javascript', 'php', 'powershell', 'sql', 'c', 'cpp', 'go', 'yak'],
    globalVariablesList: [
        { key: '{{url}}', value: 'http://127.0.0.1' },
        { key: '{{ip}}', value: '192.168.1.1' }
    ],
    fileBindings: []
};

export class PayloadSettingTab extends PluginSettingTab {
    plugin: PayloadPlugin;

    constructor(app: App, plugin: PayloadPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl('h2', { text: 'Payload Cards 设置' });

        new Setting(containerEl)
            .setName('启用自定义颜色')
            .setDesc('开启后，卡片将使用您选择的颜色，而不是 Obsidian 的默认主题色。')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.useCustomColor)
                .onChange(async (value) => {
                    this.plugin.settings.useCustomColor = value;
                    await this.plugin.saveSettings();
                    this.plugin.applySettings();
                    this.display(); // re-render to show/hide color picker
                }));

        if (this.plugin.settings.useCustomColor) {
            new Setting(containerEl)
                .setName('卡片主色调')
                .setDesc('选择一个颜色来替换默认的主题色。')
                .addColorPicker(picker => picker
                    .setValue(this.plugin.settings.customColor)
                    .onChange(async (value) => {
                        this.plugin.settings.customColor = value;
                        await this.plugin.saveSettings();
                        this.plugin.applySettings();
                    }));
        }

        new Setting(containerEl)
            .setName('支持的代码语言')
            .setDesc('设置在编辑弹窗中可供选择的语法高亮语言，用逗号分隔（例如: java,python,shell）。')
            .addTextArea(text => {
                text.setValue(this.plugin.settings.languages.join(', '))
                    .onChange(async (value) => {
                        this.plugin.settings.languages = value.split(',').map(s => s.trim()).filter(s => s !== '');
                        await this.plugin.saveSettings();
                    });
                text.inputEl.rows = 3;
                text.inputEl.style.width = '100%';
            });

        containerEl.createEl('h3', { text: '全局变量 (Global Variables)' });
        containerEl.createEl('p', { text: '设置全局变量，复制卡片时会自动将代码中的占位符（如 {{url}}）替换为对应的值。', cls: 'setting-item-description' });

        this.plugin.settings.globalVariablesList.forEach((variable, index) => {
            const s = new Setting(containerEl)
                .addText(text => {
                    text.setPlaceholder('{{变量名}}')
                        .setValue(variable.key)
                        .onChange(async (val) => {
                            variable.key = val;
                            await this.plugin.saveSettings();
                        });
                    text.inputEl.style.width = '120px';
                })
                .addText(text => {
                    text.setPlaceholder('对应值')
                        .setValue(variable.value)
                        .onChange(async (val) => {
                            variable.value = val;
                            await this.plugin.saveSettings();
                        });
                    text.inputEl.style.width = '240px';
                })
                .addButton(btn => btn
                    .setButtonText('删除')
                    .onClick(async () => {
                        this.plugin.settings.globalVariablesList.splice(index, 1);
                        await this.plugin.saveSettings();
                        this.display(); // re-render the list
                    })
                );
            s.infoEl.remove(); // Hide the name/description area for a compact row
        });

        new Setting(containerEl)
            .addButton(btn => btn
                .setButtonText('+ 新增全局变量')
                .setCta()
                .onClick(async () => {
                    this.plugin.settings.globalVariablesList.push({ key: '{{新变量}}', value: '' });
                    await this.plugin.saveSettings();
                    this.display();
                })
            );

        containerEl.createEl('h3', { text: '文件绑定 (File Binding)' });
        containerEl.createEl('p', { text: '建立 MD 文件与 TXT 文件的双向同步关系。MD 中每个 Payload 卡片对应 TXT 的一行。', cls: 'setting-item-description' });

        this.plugin.settings.fileBindings.forEach((binding, index) => {
            const s = new Setting(containerEl)
                .addToggle(toggle => toggle
                    .setValue(binding.enabled)
                    .onChange(async (val) => {
                        binding.enabled = val;
                        await this.plugin.saveSettings();
                    }))
                .addText(text => {
                    text.setPlaceholder('MD 文件路径 (如: notes/payloads.md)')
                        .setValue(binding.mdPath)
                        .onChange(async (val) => {
                            binding.mdPath = val;
                            await this.plugin.saveSettings();
                        });
                    text.inputEl.style.width = '180px';
                })
                .addText(text => {
                    text.setPlaceholder('TXT 文件路径 (如: script/out.txt)')
                        .setValue(binding.txtPath)
                        .onChange(async (val) => {
                            binding.txtPath = val;
                            await this.plugin.saveSettings();
                        });
                    text.inputEl.style.width = '180px';
                })
                .addButton(btn => btn
                    .setButtonText('删除')
                    .onClick(async () => {
                        this.plugin.settings.fileBindings.splice(index, 1);
                        await this.plugin.saveSettings();
                        this.display();
                    })
                );
            s.infoEl.remove();
        });

        new Setting(containerEl)
            .addButton(btn => btn
                .setButtonText('+ 新增文件绑定')
                .setCta()
                .onClick(async () => {
                    this.plugin.settings.fileBindings.push({ 
                        id: Date.now().toString(),
                        mdPath: '', 
                        txtPath: '', 
                        enabled: true 
                    });
                    await this.plugin.saveSettings();
                    this.display();
                })
            );
    }
}