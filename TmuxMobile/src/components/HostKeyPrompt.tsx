import React from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { ShieldAlert, ShieldCheck, ShieldX } from 'lucide-react-native';
import { formatFingerprintForDisplay } from '../storage/secureStorage';

export type TofuPromptType = 'first_connect' | 'mismatch';

interface HostKeyPromptProps {
  visible: boolean;
  type: TofuPromptType;
  host: string;
  port: number;
  fingerprint: string;
  onAccept: () => void;
  onReject: () => void;
}

export function HostKeyPrompt({
  visible,
  type,
  host,
  port,
  fingerprint,
  onAccept,
  onReject,
}: HostKeyPromptProps) {
  const isMismatch = type === 'mismatch';
  const displayFingerprint = formatFingerprintForDisplay(fingerprint);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onReject}
    >
      <View style={styles.overlay}>
        <View style={[styles.container, isMismatch && styles.containerDanger]}>
          <View style={styles.iconContainer}>
            {isMismatch ? (
              <ShieldX size={48} color="#ef4444" />
            ) : (
              <ShieldAlert size={48} color="#f59e0b" />
            )}
          </View>

          <Text style={styles.title}>
            {isMismatch ? 'Host Key Changed!' : 'Unknown Host'}
          </Text>

          <Text style={styles.hostText}>
            {host}:{port}
          </Text>

          {isMismatch ? (
            <Text style={styles.warningText}>
              The host key for this server has changed. This could indicate a 
              man-in-the-middle attack or server reconfiguration.
            </Text>
          ) : (
            <Text style={styles.infoText}>
              This is the first time connecting to this server. Please verify 
              the fingerprint with your server administrator.
            </Text>
          )}

          <View style={styles.fingerprintBox}>
            <Text style={styles.fingerprintLabel}>Fingerprint</Text>
            <Text style={styles.fingerprintValue}>{displayFingerprint}</Text>
          </View>

          {isMismatch ? (
            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[styles.button, styles.dangerButton]}
                onPress={onReject}
              >
                <Text style={styles.buttonText}>Disconnect</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[styles.button, styles.rejectButton]}
                onPress={onReject}
              >
                <Text style={styles.rejectButtonText}>Reject</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.acceptButton]}
                onPress={onAccept}
              >
                <ShieldCheck size={18} color="#fff" />
                <Text style={styles.buttonText}>Trust & Continue</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#334155',
  },
  containerDanger: {
    borderColor: '#dc2626',
    borderWidth: 2,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#f8fafc',
    textAlign: 'center',
    marginBottom: 8,
  },
  hostText: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    fontFamily: 'monospace',
    marginBottom: 16,
  },
  warningText: {
    fontSize: 14,
    color: '#fca5a5',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  infoText: {
    fontSize: 14,
    color: '#cbd5e1',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  fingerprintBox: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },
  fingerprintLabel: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 4,
  },
  fingerprintValue: {
    fontSize: 14,
    color: '#22d3ee',
    fontFamily: 'monospace',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8,
  },
  acceptButton: {
    backgroundColor: '#059669',
  },
  rejectButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#475569',
  },
  dangerButton: {
    backgroundColor: '#dc2626',
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  rejectButtonText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '600',
  },
});
