import { App, PluginSettingTab, Setting } from 'obsidian';
import PayloadPlugin from './main';

export interface GlobalVariable {
	key: string;
	value: string;
}

export interface PayloadSettings {
	customColor: string;
	useCustomColor: boolean;
	languages: string[];
	globalVariablesList: GlobalVariable[];
}

export const DEFAULT_SETTINGS: PayloadSettings = {
	customColor: '#086ddd',
	useCustomColor: false,
	languages: ['plaintext', 'bash', 'shell', 'python', 'java', 'javascript', 'php', 'powershell', 'sql', 'c', 'cpp', 'go', 'yak'],
	globalVariablesList: [
		{ key: '{{url}}', value: 'http://127.0.0.1' },
		{ key: '{{ip}}', value: '192.168.1.1' },
	],
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
			.setDesc('开启后卡片使用你设置的颜色，而不是 Obsidian 主题强调色。')
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.useCustomColor).onChange(async (value) => {
					this.plugin.settings.useCustomColor = value;
					await this.plugin.saveSettings();
					this.plugin.applySettings();
					this.display();
				}),
			);

		if (this.plugin.settings.useCustomColor) {
			new Setting(containerEl)
				.setName('卡片主色')
				.setDesc('选择卡片强调色。')
				.addColorPicker((picker) =>
					picker.setValue(this.plugin.settings.customColor).onChange(async (value) => {
						this.plugin.settings.customColor = value;
						await this.plugin.saveSettings();
						this.plugin.applySettings();
					}),
				);
		}

		new Setting(containerEl)
			.setName('支持的代码语言')
			.setDesc('编辑弹窗中的语言下拉选项，使用英文逗号分隔。')
			.addTextArea((text) => {
				text.setValue(this.plugin.settings.languages.join(', ')).onChange(async (value) => {
					this.plugin.settings.languages = value
						.split(',')
						.map((s) => s.trim())
						.filter((s) => s !== '');
					await this.plugin.saveSettings();
				});
				text.inputEl.rows = 3;
				text.inputEl.style.width = '100%';
			});

		containerEl.createEl('h3', { text: '全局变量' });
		containerEl.createEl('p', {
			text: '复制代码时会自动替换这里定义的变量，比如 {{url}}。',
			cls: 'setting-item-description',
		});

		this.plugin.settings.globalVariablesList.forEach((variable, index) => {
			const row = new Setting(containerEl)
				.addText((text) => {
					text.setPlaceholder('{{var}}')
						.setValue(variable.key)
						.onChange(async (val) => {
							variable.key = val;
							await this.plugin.saveSettings();
						});
					text.inputEl.style.width = '120px';
				})
				.addText((text) => {
					text.setPlaceholder('value')
						.setValue(variable.value)
						.onChange(async (val) => {
							variable.value = val;
							await this.plugin.saveSettings();
						});
					text.inputEl.style.width = '240px';
				})
				.addButton((btn) =>
					btn.setButtonText('删除').onClick(async () => {
						this.plugin.settings.globalVariablesList.splice(index, 1);
						await this.plugin.saveSettings();
						this.display();
					}),
				);

			row.infoEl.remove();
		});

		new Setting(containerEl).addButton((btn) =>
			btn
				.setButtonText('+ 添加全局变量')
				.setCta()
				.onClick(async () => {
					this.plugin.settings.globalVariablesList.push({ key: '{{new_var}}', value: '' });
					await this.plugin.saveSettings();
					this.display();
				}),
		);
	}
}
