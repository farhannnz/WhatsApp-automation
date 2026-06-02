import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactFlow, {
    Background, Controls, MiniMap,
    addEdge, useNodesState, useEdgesState,
    Panel
} from 'reactflow';
import 'reactflow/dist/style.css';
import api from '../api';
import NodePanel from '../components/flow/NodePanel';
import TriggerNode from '../components/flow/nodes/TriggerNode';
import MessageNode from '../components/flow/nodes/MessageNode';
import ImageNode from '../components/flow/nodes/ImageNode';
import OptionsNode from '../components/flow/nodes/OptionsNode';
import CollectNode from '../components/flow/nodes/CollectNode';
import ConditionNode from '../components/flow/nodes/ConditionNode';
import HandoverNode from '../components/flow/nodes/HandoverNode';
import SaveDataNode from '../components/flow/nodes/SaveDataNode';
import EndNode from '../components/flow/nodes/EndNode';
import NodeEditor from '../components/flow/NodeEditor';
import styles from './FlowBuilder.module.css';

const nodeTypes = {
    trigger: TriggerNode,
    message: MessageNode,
    image: ImageNode,
    options: OptionsNode,
    collect: CollectNode,
    condition: ConditionNode,
    handover: HandoverNode,
    save_data: SaveDataNode,
    end: EndNode
};

let nodeIdCounter = 1;
function newId() { return `node_${Date.now()}_${nodeIdCounter++}`; }

export default function FlowBuilder() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [flow, setFlow] = useState(null);
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [selectedNode, setSelectedNode] = useState(null);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const reactFlowWrapper = useRef(null);
    const [reactFlowInstance, setReactFlowInstance] = useState(null);

    useEffect(() => {
        api.get(`/flows/${id}`).then(r => {
            setFlow(r.data);
            setNodes(r.data.nodes || []);
            setEdges(r.data.edges || []);
        }).catch(() => navigate('/dashboard'));
    }, [id]);

    const onConnect = useCallback(
        (params) => setEdges(eds => addEdge({ ...params, animated: true, style: { stroke: '#6366f1' } }, eds)),
        []
    );

    function addNode(type) {
        const position = reactFlowInstance
            ? reactFlowInstance.project({ x: 300 + Math.random() * 100, y: 200 + Math.random() * 100 })
            : { x: 300, y: 200 };

        const defaults = {
            trigger: { matchType: 'any', keyword: '' },
            message: { text: 'Hello! How can I help you?' },
            image: { filename: null, caption: '', previewUrl: null },
            options: { question: 'Please choose an option:', options: [{ label: 'Option 1' }, { label: 'Option 2' }], saveField: '' },
            collect: { question: 'What is your name?', field: 'name' },
            condition: { field: 'name', operator: 'equals', value: '' },
            handover: { notifyNumber: '', notifyMessage: '', replyText: 'Our team will reach out shortly!' },
            save_data: { label: 'Save Data' },
            end: { text: 'Thank you! Have a great day 😊' }
        };

        const node = {
            id: newId(),
            type,
            position,
            data: { ...defaults[type], label: type.charAt(0).toUpperCase() + type.slice(1) }
        };

        setNodes(ns => [...ns, node]);
    }

    function updateNodeData(nodeId, newData) {
        setNodes(ns => ns.map(n => n.id === nodeId ? { ...n, data: { ...n.data, ...newData } } : n));
        if (selectedNode?.id === nodeId) {
            setSelectedNode(s => ({ ...s, data: { ...s.data, ...newData } }));
        }
    }

    function deleteNode(nodeId) {
        setNodes(ns => ns.filter(n => n.id !== nodeId));
        setEdges(es => es.filter(e => e.source !== nodeId && e.target !== nodeId));
        setSelectedNode(null);
    }

    async function save() {
        setSaving(true);
        try {
            await api.put(`/flows/${id}`, { name: flow.name, nodes, edges });
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } catch {}
        setSaving(false);
    }

    async function activate() {
        await api.patch(`/flows/${id}/activate`);
        setFlow(f => ({ ...f, active: true }));
    }

    if (!flow) return <div className={styles.loading}>Loading flow...</div>;

    return (
        <div className={styles.page}>
            {/* Top bar */}
            <div className={styles.topbar}>
                <button className={styles.back} onClick={() => navigate('/dashboard')}>← Back</button>
                <div className={styles.flowName}>
                    <span>{flow.name}</span>
                    {flow.active && <span className={styles.activeBadge}>● Active</span>}
                </div>
                <div className={styles.topActions}>
                    {!flow.active && (
                        <button className={styles.btnActivate} onClick={activate}>Activate</button>
                    )}
                    <button className={styles.btnSave} onClick={save} disabled={saving}>
                        {saving ? 'Saving...' : saved ? '✓ Saved' : 'Save Flow'}
                    </button>
                </div>
            </div>

            <div className={styles.builder}>
                {/* Left panel — add nodes */}
                <NodePanel onAdd={addNode} />

                {/* Canvas */}
                <div className={styles.canvas} ref={reactFlowWrapper}>
                    <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onConnect={onConnect}
                        nodeTypes={nodeTypes}
                        onInit={setReactFlowInstance}
                        onNodeClick={(_, node) => setSelectedNode(node)}
                        onPaneClick={() => setSelectedNode(null)}
                        fitView
                        deleteKeyCode="Delete"
                    >
                        <Background color="#2d3148" gap={20} />
                        <Controls />
                        <MiniMap nodeColor="#6366f1" maskColor="rgba(15,17,23,0.8)" />
                        <Panel position="bottom-center">
                            <div className={styles.hint}>Click a node to edit · Delete key removes selected node · Drag handles to connect</div>
                        </Panel>
                    </ReactFlow>
                </div>

                {/* Right panel — node editor */}
                {selectedNode && (
                    <NodeEditor
                        node={selectedNode}
                        onChange={data => updateNodeData(selectedNode.id, data)}
                        onDelete={() => deleteNode(selectedNode.id)}
                        onClose={() => setSelectedNode(null)}
                    />
                )}
            </div>
        </div>
    );
}
