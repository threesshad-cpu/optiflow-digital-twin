import React, { useState, useEffect, useRef } from 'react';

const AIForeman = ({ messages, onSendMessage }) => {
    const [input, setInput] = useState("");
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSend = () => {
        if (input.trim()) {
            onSendMessage(input);
            setInput("");
        }
    };

    const activeQueries = [
        "Analyze fleet battery health",
        "What is moving to Quality Control?",
        "Which AGV has the heaviest load?",
        "Show active deadlocks"
    ];

    const quickActions = [
        { label: "Force Deadlock Resolution", cmd: "Force resolution of deadlocks", color: "#f59e0b" },
        { label: "Global Emergency Stop", cmd: "Global Emergency Stop", color: "#ef4444" },
        { label: "Resume Operations", cmd: "Resume operations", color: "#10b981" }
    ];

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: 'white',
            borderRadius: 16,
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            border: '1px solid #e2e8f0',
            overflow: 'hidden',
            fontFamily: '"Inter", sans-serif',
            height: '100%',
            maxHeight: '600px', // Optional cap
            width: '100%'
        }}>
            {/* Header */}
            <div style={{
                padding: '16px 20px',
                borderBottom: '1px solid #f1f5f9',
                background: '#f8fafc',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 8, height: 8, background: '#10b981', borderRadius: '50%', boxShadow: '0 0 8px #10b981' }}></div>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>AI FOREMAN</span>
                </div>
                <span style={{ fontSize: 10, fontWeight: 600, color: '#64748b', background: '#e2e8f0', padding: '2px 8px', borderRadius: 10 }}>BETA</span>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, padding: 16, overflowY: 'auto', background: '#ffffff', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {messages.map((m, i) => (
                    <div key={i} style={{
                        alignSelf: m.type === 'user' ? 'flex-end' : 'flex-start',
                        maxWidth: '85%'
                    }}>
                        <div style={{
                            background: m.type === 'user' ? '#0f172a' : '#f1f5f9',
                            color: m.type === 'user' ? 'white' : '#334155',
                            padding: '8px 12px',
                            borderRadius: m.type === 'user' ? '12px 12px 0 12px' : '12px 12px 12px 0',
                            fontSize: 13,
                            lineHeight: 1.4,
                            boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                        }}>
                            {m.text}
                        </div>
                        {m.type === 'bot' && <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 4, marginLeft: 4 }}>AI ASSISTANT</div>}
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            {/* Suggested Queries */}
            <div style={{ padding: '8px 16px', display: 'flex', gap: 6, overflowX: 'auto', borderTop: '1px solid #f1f5f9', scrollbarWidth: 'none' }}>
                {activeQueries.map((q, i) => (
                    <button key={i}
                        onClick={() => onSendMessage(q)}
                        style={{
                            flexShrink: 0,
                            background: 'white',
                            border: '1px solid #cbd5e1',
                            color: '#475569',
                            padding: '4px 10px',
                            borderRadius: 20,
                            fontSize: 10,
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            whiteSpace: 'nowrap'
                        }}
                        onMouseOver={(e) => e.currentTarget.style.borderColor = '#94a3b8'}
                        onMouseOut={(e) => e.currentTarget.style.borderColor = '#cbd5e1'}
                    >
                        {q}
                    </button>
                ))}
            </div>

            {/* Quick Actions */}
            <div style={{ padding: '0 16px 8px', display: 'flex', gap: 8, justifyContent: 'center' }}>
                {quickActions.map((action, i) => (
                    <button key={i}
                        onClick={() => onSendMessage(action.cmd)}
                        style={{
                            flex: 1,
                            background: action.color,
                            border: 'none',
                            color: 'white',
                            padding: '8px 0',
                            borderRadius: 6,
                            fontSize: 10,
                            fontWeight: 700,
                            cursor: 'pointer',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                        }}
                    >
                        {action.label}
                    </button>
                ))}
            </div>

            {/* Input */}
            <div style={{ padding: 16, borderTop: '1px solid #f1f5f9', background: 'white' }}>
                <div style={{ display: 'flex', gap: 8 }}>
                    <input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        placeholder="Ask AI Foreman..."
                        style={{
                            flex: 1,
                            padding: '10px 14px',
                            borderRadius: 8,
                            border: '1px solid #e2e8f0',
                            outline: 'none',
                            fontSize: 12,
                            color: '#0f172a',
                            background: '#f8fafc'
                        }}
                    />
                    <button
                        onClick={handleSend}
                        style={{
                            background: '#0f172a',
                            color: 'white',
                            border: 'none',
                            borderRadius: 8,
                            width: 40,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                    >
                        ➤
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AIForeman;
