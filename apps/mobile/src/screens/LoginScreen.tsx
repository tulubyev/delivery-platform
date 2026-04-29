import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native'
import { api } from '../lib/api'
import { useAuthStore } from '../store/auth.store'

export function LoginScreen() {
  const { setAuth } = useAuthStore()
  const [email, setEmail]           = useState('')
  const [password, setPassword]     = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError]           = useState('')
  const [loading, setLoading]       = useState(false)

  const handleLogin = async () => {
    if (!email || !password) return
    setLoading(true); setError('')
    try {
      const { data } = await api.post('/auth/login', { email, password })
      const { user, accessToken, refreshToken } = data.data
      if (user.role !== 'COURIER') { setError('Этот аккаунт не является курьерским'); return }
      await setAuth(user, accessToken, refreshToken)
    } catch (e: unknown) {
      setError((e as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Неверный email или пароль')
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <View style={styles.inner}>
        <View style={styles.logo}>
          <Text style={styles.logoIcon}>🚚</Text>
        </View>
        <Text style={styles.title}>LastMiles</Text>
        <Text style={styles.subtitle}>Приложение курьера</Text>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#94a3b8"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            value={email}
            onChangeText={setEmail}
          />

          <View style={styles.passwordWrap}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Пароль"
              placeholderTextColor="#94a3b8"
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              value={password}
              onChangeText={setPassword}
            />
            <TouchableOpacity
              style={styles.eyeBtn}
              onPress={() => setShowPassword(v => !v)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.eyeIcon}>{showPassword ? '🙈' : '👁️'}</Text>
            </TouchableOpacity>
          </View>

          {!!error && <Text style={styles.error}>{error}</Text>}

          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Войти</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: '#f8fafc' },
  inner:         { flex: 1, justifyContent: 'center', padding: 24 },
  logo:          { alignSelf: 'center', width: 72, height: 72, borderRadius: 20, backgroundColor: '#2563eb', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  logoIcon:      { fontSize: 32 },
  title:         { fontSize: 28, fontWeight: '700', color: '#0f172a', textAlign: 'center' },
  subtitle:      { fontSize: 14, color: '#64748b', textAlign: 'center', marginBottom: 40 },
  form:          { gap: 12 },
  input:         { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 12, fontSize: 16, color: '#0f172a' },
  passwordWrap:  { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10 },
  passwordInput: { flex: 1, paddingHorizontal: 16, paddingVertical: 12, fontSize: 16, color: '#0f172a' },
  eyeBtn:        { paddingHorizontal: 14 },
  eyeIcon:       { fontSize: 18 },
  error:         { color: '#dc2626', fontSize: 13, textAlign: 'center' },
  btn:           { backgroundColor: '#2563eb', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  btnDisabled:   { opacity: 0.6 },
  btnText:       { color: '#fff', fontSize: 16, fontWeight: '600' },
})
