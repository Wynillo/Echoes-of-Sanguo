import { useState, useMemo } from 'react';
import { useTranslation }   from 'react-i18next';
import { useScreen }        from '../contexts/ScreenContext.js';
import { useCampaign }      from '../contexts/CampaignContext.js';
import { useGame }           from '../contexts/GameContext.js';
import { OPPONENT_CONFIGS }  from '../../cards.js';
import type { CampaignNode, Chapter } from '../../campaign-types.js';
import styles from './CampaignScreen.module.css';

const NODE_ICONS: Record<CampaignNode['type'], string> = {
  duel:   '\u2694',   // crossed swords
  story:  '\uD83D\uDCD6', // open book
  reward: '\uD83C\uDF81', // gift
  shop:   '\uD83D\uDED2', // shopping cart
  branch: '\u2726',   // star
};

const GAUNTLET_ICON = '\uD83D\uDD25'; // fire — used for gauntlet duel nodes

export default function CampaignScreen() {
  const { t } = useTranslation();
  const { navigateTo } = useScreen();
  const { campaignData, progress, isNodeUnlocked, completeNode, getOpponentForNode, setPendingDuel } = useCampaign();
  const { startGame } = useGame();
  const [activeChapterIdx, setActiveChapterIdx] = useState(0);
  const [dialogueNode, setDialogueNode] = useState<CampaignNode | null>(null);

  const chapters = campaignData.chapters;
  const activeChapter: Chapter | undefined = chapters[activeChapterIdx];

  // Compute map dimensions from node positions
  const mapSize = useMemo(() => {
    if (!activeChapter) return { width: 800, height: 500 };
    let maxX = 0;
    let maxY = 0;
    for (const node of activeChapter.nodes) {
      if (node.position.x > maxX) maxX = node.position.x;
      if (node.position.y > maxY) maxY = node.position.y;
    }
    return { width: Math.max(maxX + 80, 400), height: Math.max(maxY + 80, 300) };
  }, [activeChapter]);

  function getNodeState(node: CampaignNode): 'completed' | 'available' | 'locked' {
    if (progress.completedNodes.includes(node.id)) return 'completed';
    if (isNodeUnlocked(node.id)) return 'available';
    return 'locked';
  }

  function handleNodeClick(node: CampaignNode) {
    const state = getNodeState(node);
    if (state === 'locked') return;

    switch (node.type) {
      case 'duel': {
        if (node.gauntlet && node.gauntlet.length > 0) {
          // Gauntlet: fight all opponents in sequence
          const firstOppId = node.gauntlet[0];
          const firstCfg = (OPPONENT_CONFIGS as import('../../types.js').OpponentConfig[]).find(c => c.id === firstOppId);
          if (firstCfg) {
            setPendingDuel({
              nodeId: node.id,
              completeOnLoss: node.completeOnLoss,
              rewards: node.rewards,
              postDialogue: node.dialogueKeys,
              gauntletOpponents: node.gauntlet,
              gauntletIndex: 0,
            });
            startGame(firstCfg);
            navigateTo('game');
          }
        } else {
          // Standard single duel
          const opponent = getOpponentForNode(node.id);
          if (opponent) {
            setPendingDuel({
              nodeId: node.id,
              completeOnLoss: node.completeOnLoss,
              rewards: node.rewards,
              postDialogue: node.dialogueKeys,
            });
            startGame(opponent);
            navigateTo('game');
          }
        }
        break;
      }
      case 'story':
        setDialogueNode(node);
        break;
      case 'reward':
        if (state === 'available') {
          completeNode(node.id);
        }
        break;
      case 'shop':
        navigateTo('shop');
        break;
      case 'branch':
        // Branch nodes auto-complete when clicked
        if (state === 'available') {
          completeNode(node.id);
        }
        break;
    }
  }

  function handleDialogueClose() {
    if (dialogueNode && getNodeState(dialogueNode) === 'available') {
      completeNode(dialogueNode.id);
    }
    setDialogueNode(null);
  }

  // Build connection lines from node.connections
  const connections = useMemo(() => {
    if (!activeChapter) return [];
    const nodeMap = new Map(activeChapter.nodes.map(n => [n.id, n]));
    const lines: Array<{ from: CampaignNode; to: CampaignNode; completed: boolean }> = [];
    for (const node of activeChapter.nodes) {
      if (node.connections) {
        for (const targetId of node.connections) {
          const target = nodeMap.get(targetId);
          if (target) {
            const completed = progress.completedNodes.includes(node.id) && progress.completedNodes.includes(targetId);
            lines.push({ from: node, to: target, completed });
          }
        }
      }
    }
    return lines;
  }, [activeChapter, progress.completedNodes]);

  if (!activeChapter) {
    return (
      <div className={styles.screen}>
        <div className={styles.header}>
          <h2 className={styles.title}>{t('campaign.title')}</h2>
          <button className={`btn-secondary ${styles.backBtn}`} onClick={() => navigateTo('title')}>{t('common.back')}</button>
        </div>
        <p style={{ color: '#6080a0', marginTop: 40 }}>{t('campaign.no_data')}</p>
      </div>
    );
  }

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <h2 className={styles.title}>{t('campaign.title')}</h2>
        <p className={styles.chapterTitle}>
          {t('campaign.chapter')} — {t(`campaign.chapter_${activeChapter.id}`, activeChapter.id)}
        </p>
        <button className={`btn-secondary ${styles.backBtn}`} onClick={() => navigateTo('title')}>{t('common.back')}</button>
      </div>

      {chapters.length > 1 && (
        <div className={styles.chapterNav}>
          {chapters.map((ch, idx) => (
            <button
              key={ch.id}
              className={`${styles.chapterTab}${idx === activeChapterIdx ? ` ${styles.chapterTabActive}` : ''}`}
              onClick={() => setActiveChapterIdx(idx)}
            >
              {t(`campaign.chapter_${ch.id}`, ch.id)}
            </button>
          ))}
        </div>
      )}

      <div className={styles.mapContainer}>
        <div className={styles.mapInner} style={{ width: mapSize.width, height: mapSize.height }}>
          {/* Connection lines (SVG overlay) */}
          <svg
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
            viewBox={`0 0 ${mapSize.width} ${mapSize.height}`}
            preserveAspectRatio="none"
          >
            {connections.map((conn, i) => (
              <line
                key={i}
                x1={conn.from.position.x}
                y1={conn.from.position.y}
                x2={conn.to.position.x}
                y2={conn.to.position.y}
                className={`${styles.connectionLine}${conn.completed ? ` ${styles.connectionLineCompleted}` : ''}`}
              />
            ))}
          </svg>

          {/* Nodes */}
          {activeChapter.nodes.map(node => {
            const state = getNodeState(node);
            const nodeClass = [
              styles.node,
              state === 'completed' ? styles.nodeCompleted : '',
              state === 'available' ? styles.nodeAvailable : '',
              state === 'locked' ? styles.nodeLocked : '',
            ].filter(Boolean).join(' ');

            const labelClass = [
              styles.nodeLabel,
              state === 'completed' ? styles.nodeLabelCompleted : '',
              state === 'available' ? styles.nodeLabelAvailable : '',
            ].filter(Boolean).join(' ');

            return (
              <div
                key={node.id}
                className={nodeClass}
                style={{ left: node.position.x, top: node.position.y }}
                onClick={() => handleNodeClick(node)}
                title={state === 'locked' ? t('campaign.locked') : node.id}
              >
                <span className={styles.nodeIcon}>
                  {node.gauntlet && node.gauntlet.length > 0 ? GAUNTLET_ICON : NODE_ICONS[node.type]}
                </span>
                <span className={labelClass}>
                  {t(`campaign.node_${node.id}`, node.id)}
                  {node.gauntlet && node.gauntlet.length > 0 && (
                    <span style={{ fontSize: '0.6em', opacity: 0.7, marginLeft: 4 }}>
                      ({node.gauntlet.length} {t('gauntlet.duels')})
                    </span>
                  )}
                </span>
                <span className={`${styles.nodeStatus} ${
                  state === 'completed' ? styles.statusCompleted :
                  state === 'available' ? styles.statusAvailable :
                  styles.statusLocked
                }`}>
                  {t(`campaign.${state}`)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Story dialogue overlay */}
      {dialogueNode && (
        <div className={styles.dialogueOverlay} onClick={handleDialogueClose}>
          <div className={styles.dialogueBox} onClick={e => e.stopPropagation()}>
            {(dialogueNode.dialogueKeys ?? []).map((key, i) => (
              <p key={i} className={styles.dialogueText}>{t(key, key)}</p>
            ))}
            {(!dialogueNode.dialogueKeys || dialogueNode.dialogueKeys.length === 0) && (
              <p className={styles.dialogueText}>{t(`campaign.story_${dialogueNode.id}`, '...')}</p>
            )}
            <button className={`btn-primary ${styles.dialogueClose}`} onClick={handleDialogueClose}>
              {t('common.ok')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
