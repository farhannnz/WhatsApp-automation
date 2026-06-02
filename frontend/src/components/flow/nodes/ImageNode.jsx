import { Handle, Position } from 'reactflow';
import styles from './baseNode.module.css';

export default function ImageNode({ data }) {
    return (
        <div className={styles.node} style={{ borderColor: '#f472b6' }}>
            <div className={styles.header} style={{ background: 'rgba(244,114,182,0.1)' }}>
                <span className={styles.icon}>🖼️</span>
                <span className={styles.label}>Send Image</span>
            </div>
            <div className={styles.body}>
                {data.previewUrl ? (
                    <img src={data.previewUrl} alt="preview" style={{ width: '100%', borderRadius: 6, maxHeight: 80, objectFit: 'cover' }} />
                ) : (
                    <span style={{ color: '#6b7280', fontSize: 11 }}>No image selected</span>
                )}
                {data.caption && <div style={{ marginTop: 4, fontSize: 11, color: '#9ca3af' }}>{data.caption.slice(0, 40)}</div>}
            </div>
            <Handle type="target" position={Position.Top} style={{ background: '#f472b6' }} />
            <Handle type="source" position={Position.Bottom} style={{ background: '#f472b6' }} />
        </div>
    );
}
