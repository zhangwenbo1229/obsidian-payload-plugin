import { App, TFile, Notice } from 'obsidian';
import { FileBinding, PayloadSettings } from './settings';
import { parsePayload } from './processor';

// Use a simple lock to prevent infinite loops
const syncingFiles = new Set<string>();

interface PayloadBlockInfo {
    fullMatch: string;
    code: string;
    metaLines: string[];
    isUsed: boolean;
}

export async function syncMdToTxt(app: App, settings: PayloadSettings, mdFile: TFile) {
    if (syncingFiles.has(mdFile.path)) return;
    
    const bindings = settings.fileBindings.filter(b => b.enabled && b.mdPath === mdFile.path);
    if (bindings.length === 0) return;

    try {
        const content = await app.vault.read(mdFile);
        const payloadBlocks = extractPayloadBlocks(content);
        const codes = payloadBlocks.map(block => {
            // Replace newlines within code with space to maintain line mapping
            return block.code.replace(/\n/g, ' ').trim();
        });

        const txtContent = codes.join('\n');

        for (const binding of bindings) {
            const txtFile = app.vault.getAbstractFileByPath(binding.txtPath);
            if (txtFile instanceof TFile) {
                const oldTxt = await app.vault.read(txtFile);
                if (oldTxt.trim() !== txtContent.trim()) {
                    syncingFiles.add(txtFile.path);
                    await app.vault.modify(txtFile, txtContent);
                    setTimeout(() => syncingFiles.delete(txtFile.path), 500);
                }
            }
        }
    } catch (err) {
        console.error("Payload Sync MD->TXT Error:", err);
    }
}

export async function syncTxtToMd(app: App, settings: PayloadSettings, txtFile: TFile) {
    if (syncingFiles.has(txtFile.path)) return;

    const bindings = settings.fileBindings.filter(b => b.enabled && b.txtPath === txtFile.path);
    if (bindings.length === 0) return;

    try {
        const txtContent = await app.vault.read(txtFile);
        const newCodes = txtContent.split('\n').filter(line => line.trim() !== '');

        for (const binding of bindings) {
            const mdFile = app.vault.getAbstractFileByPath(binding.mdPath);
            if (mdFile instanceof TFile) {
                const mdContent = await app.vault.read(mdFile);
                const oldBlocks = extractPayloadBlocks(mdContent);
                const updatedMd = reconstructMdContent(mdContent, oldBlocks, newCodes);
                
                if (mdContent.trim() !== updatedMd.trim()) {
                    syncingFiles.add(mdFile.path);
                    await app.vault.modify(mdFile, updatedMd);
                    setTimeout(() => syncingFiles.delete(mdFile.path), 500);
                }
            }
        }
    } catch (err) {
        console.error("Payload Sync TXT->MD Error:", err);
    }
}

function extractPayloadBlocks(content: string): PayloadBlockInfo[] {
    const regex = /```payload\n([\s\S]*?)\n```/g;
    const blocks: PayloadBlockInfo[] = [];
    let match;
    while ((match = regex.exec(content)) !== null) {
        const inner = match[1] || "";
        const data = parsePayload(inner);
        const metaLines: string[] = [];
        
        // Extract meta lines from inner content
        inner.split('\n').forEach(line => {
            const trimmed = line.trim();
            if (trimmed.startsWith('[') || trimmed.startsWith('#') || 
                trimmed.startsWith('>') || trimmed.startsWith('@') || 
                trimmed.startsWith('$') || trimmed.startsWith('?')) {
                metaLines.push(line);
            }
        });

        blocks.push({
            fullMatch: match[0],
            code: data.code.replace(/\n/g, ' ').trim(), // Standardize code for matching
            metaLines: metaLines,
            isUsed: false
        });
    }
    return blocks;
}

function reconstructMdContent(content: string, oldBlocks: PayloadBlockInfo[], newCodes: string[]): string {
    const matchedBlocks: (PayloadBlockInfo | null)[] = new Array(newCodes.length).fill(null);

    // Phase 1: Exact content matching (Move detection)
    newCodes.forEach((newCode, i) => {
        const cleanNewCode = newCode.trim();
        const found = oldBlocks.find(b => !b.isUsed && b.code === cleanNewCode);
        if (found) {
            found.isUsed = true;
            matchedBlocks[i] = found;
        }
    });

    // Phase 2: Positional inheritance (Update detection)
    newCodes.forEach((newCode, i) => {
        if (!matchedBlocks[i]) {
            // Inherit from the same position if not used by a precise match elsewhere
            if (oldBlocks[i] && !oldBlocks[i].isUsed) {
                oldBlocks[i].isUsed = true;
                matchedBlocks[i] = {
                    ...oldBlocks[i],
                    code: newCode.trim() // Update the code content
                };
            }
        }
    });

    // Construct the new block string list
    const newBlocksText = newCodes.map((newCode, i) => {
        const block = matchedBlocks[i];
        const metaStr = block ? block.metaLines.join('\n') : '';
        const codeStr = newCode.trim();
        return `\`\`\`payload\n${metaStr}${metaStr ? '\n' : ''}${codeStr}\n\`\`\``;
    }).join('\n\n');

    // Replace the entire payload area in the MD file
    const regex = /```payload\n[\s\S]*?\n```/g;
    const allMatches = Array.from(content.matchAll(regex));
    
    if (allMatches.length === 0) {
        // If no blocks, just append to end
        return content.trimEnd() + "\n\n" + newBlocksText;
    }

    const firstMatch = allMatches[0];
    const lastMatch = allMatches[allMatches.length - 1];
    
    if (!firstMatch || !lastMatch || firstMatch.index === undefined || lastMatch.index === undefined) {
        return content.trimEnd() + "\n\n" + newBlocksText;
    }

    const startPos = firstMatch.index;
    const endPos = lastMatch.index + lastMatch[0].length;

    return content.substring(0, startPos) + newBlocksText + content.substring(endPos);
}