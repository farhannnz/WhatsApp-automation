import { useState, useRef } from 'react';
import api from '../../api';
import styles from './ImageUpload.module.css';

export default function ImageUpload({ value, previewUrl, onChange }) {
    const [uploading, setUploading] = useState(false);
    const [preview, setPreview] = useState(previewUrl || null);
    const fileRef = useRef();

    async function handleFile(e) {
        const file = e.target.files[0];
        if (!file) return;

        // Show local preview immediately
        const localUrl = URL.createObjectURL(file);
        setPreview(localUrl);

        setUploading(true);
        try {
            const form = new FormData();
            form.append('file', file);
            const r = await api.post('/media/upload', form, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            onChange({ filename: r.data.filename, previewUrl: localUrl, originalName: r.data.originalName });
        } catch (err) {
            alert('Upload failed: ' + (err.response?.data?.error || err.message));
            setPreview(null);
        } finally {
            setUploading(false);
        }
    }

    function remove() {
        setPreview(null);
        onChange({ filename: null, previewUrl: null, originalName: null });
        fileRef.current.value = '';
    }

    return (
        <div className={styles.wrap}>
            <input type="file" accept="image/*,video/*,application/pdf" ref={fileRef} onChange={handleFile} style={{ display: 'none' }} />
            {preview ? (
                <div className={styles.previewWrap}>
                    <img src={preview} alt="preview" className={styles.preview} />
                    <button className={styles.removeBtn} onClick={remove}>✕ Remove</button>
                </div>
            ) : (
                <button className={styles.uploadBtn} onClick={() => fileRef.current.click()} disabled={uploading}>
                    {uploading ? '⏳ Uploading...' : '📎 Choose Image / File'}
                </button>
            )}
        </div>
    );
}
