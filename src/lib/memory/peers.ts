import type { Peer, Session } from '@honcho-ai/sdk';
import { getHonchoClient } from './client';
import { BOT_PEER_ID, resolvePeerId } from './utils';

const client = getHonchoClient();
const observedPeers = new Set<string>();

export async function getBotPeer(): Promise<Peer> {
  return client.peer(BOT_PEER_ID, {
    configuration: { observeMe: false },
  });
}

export async function getUserPeer(userId: string): Promise<Peer> {
  return client.peer(resolvePeerId(userId), {
    configuration: { observeMe: true },
  });
}

export async function ensureSessionPeers(
  session: Session,
  peers: Array<{
    peer: Peer;
    configuration: { observeMe: boolean; observeOthers: boolean };
  }>,
) {
  const missing = peers.filter(
    ({ peer }) => !observedPeers.has(`${session.id}:${peer.id}`),
  );

  if (missing.length === 0) return;

  await session.addPeers(missing.map(({ peer }) => peer));

  await Promise.all(
    missing.map(({ peer, configuration }) =>
      session.setPeerConfiguration(peer, configuration),
    ),
  );

  for (const { peer } of missing) {
    observedPeers.add(`${session.id}:${peer.id}`);
  }
}
