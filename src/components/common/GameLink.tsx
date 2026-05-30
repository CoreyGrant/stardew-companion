import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import React from 'react';
import { useGameData } from '../../contexts/GameDataContext';
import { SpriteIcon } from '../farm/SpriteIcon';
import { PortraitImg } from './PortraitImg';

type GameLinkType = 'npc' | 'item' | 'quest';

const BASE_PATH: Record<GameLinkType, string> = {
  npc: '/characters',
  item: '/items',
  quest: '/quests',
};

const BASE = import.meta.env.BASE_URL;
const ICON_SIZE = 16;

interface Props {
  type: GameLinkType;
  id: string;
  children: ReactNode;
  className?: string;
  onClick?: React.MouseEventHandler<HTMLAnchorElement>;
}

export function GameLink({ type, id, children, className, onClick }: Props) {
  const { data } = useGameData();
  const to = `${BASE_PATH[type]}/${id}`;

  let icon: ReactNode = null;

  if (type === 'npc' && data) {
    const npc = data.npcs.find((n) => n.id === id);
    if (npc?.portrait) {
      icon = (
        <PortraitImg
          src={`${BASE}sprites/portraits/${npc.portrait}`}
          size={ICON_SIZE}
        />
      );
    }
  } else if (type === 'item' && data) {
    const item = data.items.find((i) => i.id === id);
    if (item?.spriteSheet && item.spriteIndex !== undefined) {
      icon = (
        <SpriteIcon
          spriteSheet={item.spriteSheet}
          spriteIndex={item.spriteIndex}
          isBigCraftable={item.isBigCraftable}
          size={ICON_SIZE}
          style={item.isBigCraftable ? { height: ICON_SIZE } : undefined}
        />
      );
    }
  }

  return (
    <Link to={to} className={`game-link game-link--${type}${className ? ` ${className}` : ''}`} onClick={onClick}>
      {icon}
      {children}
    </Link>
  );
}
