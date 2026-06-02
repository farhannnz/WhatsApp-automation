import styles from './NodePanel.module.css';

const NODE_TYPES = [
    { type: 'trigger',   icon: '⚡', label: 'Trigger',      desc: 'Start of flow' },
    { type: 'message',   icon: '💬', label: 'Send Message', desc: 'Send text to user' },
    { type: 'image',     icon: '🖼️', label: 'Send Image',   desc: 'Send image/file' },
    { type: 'options',   icon: '🔢', label: 'Options',      desc: 'Show choices' },
    { type: 'collect',   icon: '📝', label: 'Collect Data', desc: 'Ask & save answer' },
    { type: 'condition', icon: '🔀', label: 'Condition',    desc: 'Branch on value' },
    { type: 'save_data', icon: '💾', label: 'Save Data',    desc: 'Save to Firebase' },
    { type: 'handover',  icon: '🤝', label: 'Handover',     desc: 'Notify & pause bot' },
    { type: 'end',       icon: '🏁', label: 'End',          desc: 'End conversation' }
];

export default function NodePanel({ onAdd }) {
    return (
        <div className={styles.panel}>
            <div className={styles.title}>Add Node</div>
            <div className={styles.list}>
                {NODE_TYPES.map(n => (
                    <button key={n.type} className={styles.item} onClick={() => onAdd(n.type)}>
                        <span className={styles.icon}>{n.icon}</span>
                        <div>
                            <div className={styles.label}>{n.label}</div>
                            <div className={styles.desc}>{n.desc}</div>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
}
