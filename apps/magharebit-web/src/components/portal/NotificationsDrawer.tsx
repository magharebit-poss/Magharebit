'use client';

import { useState } from 'react';

interface Notification {
  id: number;
  icon: string;
  title: string;
  body: string;
  time: string;
  read: boolean;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onReadAll: () => void;
}

const INITIAL_NOTIFICATIONS: Notification[] = [
  {
    id: 1,
    icon: '📦',
    title: 'مخزون منخفض',
    body: '4 منتجات تحتاج إعادة تموين',
    time: 'منذ 5 دقائق',
    read: false,
  },
  {
    id: 2,
    icon: '💳',
    title: 'تجديد الاشتراك',
    body: 'اشتراكك ينتهي خلال 28 يوماً',
    time: 'منذ ساعة',
    read: false,
  },
  {
    id: 3,
    icon: '✅',
    title: 'تقرير يومي جاهز',
    body: 'تقرير مبيعات اليوم متاح للتحميل',
    time: 'منذ 3 ساعات',
    read: true,
  },
];

export default function NotificationsDrawer({ isOpen, onClose, onReadAll }: Props) {
  const [notifications, setNotifications] = useState<Notification[]>(INITIAL_NOTIFICATIONS);

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    onReadAll();
  };

  const markRead = (id: number) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.35)',
          zIndex: 150,
        }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <div
        dir="rtl"
        role="dialog"
        aria-label="الإشعارات"
        style={{
          position: 'fixed',
          top: 0,
          right: '260px', // sits to the left of the 260px sidebar
          width: '320px',
          height: '100vh',
          background: '#FFFFFF',
          zIndex: 151,
          boxShadow: '-8px 0 40px rgba(0,0,0,0.15)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Drawer header */}
        <div
          style={{
            padding: '20px 20px 16px',
            borderBottom: '1px solid #F3F4F6',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '18px' }}>🔔</span>
            <h2
              style={{
                fontSize: '16px',
                fontWeight: 700,
                color: '#111827',
                margin: 0,
                fontFamily: 'Inter, "Noto Naskh Arabic", sans-serif',
              }}
            >
              الإشعارات
            </h2>
            {unreadCount > 0 && (
              <span
                style={{
                  background: '#EF4444',
                  color: '#FFFFFF',
                  fontSize: '11px',
                  fontWeight: 700,
                  borderRadius: '999px',
                  padding: '1px 7px',
                  lineHeight: '18px',
                }}
              >
                {unreadCount}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '12px',
                  color: '#0F3D2A',
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: 0,
                  fontFamily: 'Inter, "Noto Naskh Arabic", sans-serif',
                }}
              >
                قراءة الكل
              </button>
            )}
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '18px',
                color: '#9CA3AF',
                cursor: 'pointer',
                lineHeight: 1,
                padding: '2px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              aria-label="إغلاق"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Notification list */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {notifications.length === 0 ? (
            <div
              style={{
                padding: '48px 24px',
                textAlign: 'center',
                color: '#9CA3AF',
                fontSize: '14px',
                fontFamily: 'Inter, "Noto Naskh Arabic", sans-serif',
              }}
            >
              لا توجد إشعارات
            </div>
          ) : (
            notifications.map((notif) => (
              <div
                key={notif.id}
                onClick={() => markRead(notif.id)}
                style={{
                  padding: '16px 20px',
                  borderBottom: '1px solid #F9FAFB',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  background: notif.read ? '#FFFFFF' : '#F8FDF9',
                  cursor: 'pointer',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = '#F3F4F6';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = notif.read ? '#FFFFFF' : '#F8FDF9';
                }}
              >
                {/* Icon */}
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '10px',
                    background: '#F3F4F6',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '20px',
                    flexShrink: 0,
                  }}
                >
                  {notif.icon}
                </div>

                {/* Text */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                    <p
                      style={{
                        fontSize: '14px',
                        fontWeight: notif.read ? 500 : 700,
                        color: '#111827',
                        margin: '0 0 4px',
                        fontFamily: 'Inter, "Noto Naskh Arabic", sans-serif',
                      }}
                    >
                      {notif.title}
                    </p>
                    {!notif.read && (
                      <span
                        style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          background: '#0F3D2A',
                          flexShrink: 0,
                          marginTop: '4px',
                        }}
                      />
                    )}
                  </div>
                  <p
                    style={{
                      fontSize: '13px',
                      color: '#6B7280',
                      margin: '0 0 6px',
                      fontFamily: 'Inter, "Noto Naskh Arabic", sans-serif',
                      lineHeight: 1.5,
                    }}
                  >
                    {notif.body}
                  </p>
                  <p
                    style={{
                      fontSize: '11px',
                      color: '#9CA3AF',
                      margin: 0,
                      fontFamily: 'Inter, sans-serif',
                    }}
                  >
                    {notif.time}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '14px 20px',
            borderTop: '1px solid #F3F4F6',
            flexShrink: 0,
            textAlign: 'center',
          }}
        >
          <p
            style={{
              fontSize: '12px',
              color: '#9CA3AF',
              margin: 0,
              fontFamily: 'Inter, sans-serif',
            }}
          >
            آخر تحديث: الآن
          </p>
        </div>
      </div>
    </>
  );
}
