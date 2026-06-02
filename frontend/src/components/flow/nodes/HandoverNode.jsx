import { Handle, Position } from 'reactflow';
import styles from './baseNode.module.css';

export default function HandoverNode({ data }) {
    return (
        <div className={styles.node} style={{ borderColor: '#f87171' }}>
            <div className={styles.header} style={{ background: 'rgba(248,113,113,0.1)' }}>
                <span className={styles.icon}>🤝</span>
                <span className={styles.label}>Handover</span>
            </div>
            <div className={styles.body}>
                {data.notifyNumber && <div><span className={styles.tag}>notify: {data.notifyNumber}</span></div>}
                <div style={{ marginTop: 4, fontSize: 11, color: '#9ca3af' }}>{data.replyText?.slice(0, 50)}</div>
            </div>
            <Handle type="target" position={Position.Top} style={{ background: '#f87171' }} />
        </div>
    );
}
