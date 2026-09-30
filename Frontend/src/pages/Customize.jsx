// Edit your mini self after onboarding.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlayer } from '../api/player.jsx';
import { lookOf } from '../api/look.js';
import AvatarBuilder from '../components/AvatarBuilder.jsx';
import PageHeader from '../components/PageHeader.jsx';
import SystemWindow from '../components/SystemWindow.jsx';

export default function Customize() {
  const { player, update } = usePlayer();
  const navigate = useNavigate();
  const [look, setLook] = useState(lookOf(player));

  function save() {
    update((p) => { p.look = look; });
    navigate('/profile');
  }

  return (
    <div className="page col" style={{ gap: 28 }}>
      <PageHeader eyebrow="CHARACTER" color="var(--violet-soft)" title="Customize your mini self"
        sub="Your look stays yours. The outfit and aura evolve on their own as you rank up."
        action={<div className="row"><button className="btn btn-ghost" onClick={() => navigate(-1)}>Cancel</button><button className="btn btn-blue" onClick={save}>Save look</button></div>} />
      <SystemWindow title="CHARACTER CREATION" tone="violet" icon={null}>
        <AvatarBuilder look={look} onChange={setLook} level={player.level} premium={(player.items.outfit || 0) > 0} />
      </SystemWindow>
    </div>
  );
}
