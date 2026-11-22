export function formatGoogleAuthError(
  error: unknown,
  options: { hostname?: string; port?: string; projectId?: string } = {}
): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code ?? '')
      : '';
  const rawMessage =
    error instanceof Error ? error.message : typeof error === 'string' ? error : '';

  const hostname = options.hostname?.trim() || 'atual';
  const portSuffix = options.port ? `:${options.port}` : '';
  const projectLabel = options.projectId ? ` (projeto ${options.projectId})` : '';

  if (code === 'auth/unauthorized-domain' || rawMessage.includes('auth/unauthorized-domain')) {
    if (hostname === '0.0.0.0' || hostname === '127.0.0.1') {
      return `Domínio "${hostname}" não autorizado no Firebase Auth. Acesse o aplicativo usando http://localhost${portSuffix} ou adicione "${hostname}" em Authentication > Settings > Authorized domains no Firebase Console${projectLabel}.`;
    }
    return `Domínio "${hostname}" não autorizado no Firebase Auth. Adicione "${hostname}" em Authentication > Settings > Authorized domains no Firebase Console${projectLabel} (ou acesse via http://localhost${portSuffix} em desenvolvimento local).`;
  }

  if (code === 'auth/popup-blocked' || rawMessage.includes('auth/popup-blocked')) {
    return 'O navegador bloqueou a janela de login do Google. Permita pop-ups para este site e tente novamente.';
  }

  if (code === 'auth/popup-closed-by-user' || rawMessage.includes('auth/popup-closed-by-user')) {
    return 'Login cancelado: a janela de seleção de conta Google foi fechada antes da conclusão.';
  }

  return rawMessage || 'Não foi possível concluir o login com o Google.';
}
