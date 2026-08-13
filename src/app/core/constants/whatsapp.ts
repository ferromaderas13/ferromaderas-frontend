/** Número de WhatsApp para contacto: +502 58226530 */
export const WHATSAPP_NUMBER = '50258226530';

/** Mensaje predeterminado para enlaces de contacto (footer, categorías, etc.) */
const CONTACT_MESSAGE =
  '¡Hola! Me gustaría obtener más información sobre los productos de Ferromaderas.';

/** URL para abrir WhatsApp con mensaje de consulta prellenado */
export const WHATSAPP_CONTACT_URL = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(CONTACT_MESSAGE)}`;

/**
 * Abre WhatsApp con el mensaje ya escrito.
 *
 * WhatsApp no permite que un sitio web pulse "Enviar" por vos (anti-spam).
 * Lo que sí hacemos es saltar la página intermedia de api.whatsapp.com y
 * abrir la app de escritorio / el teléfono, o WhatsApp Web como respaldo.
 */
export function openWhatsAppChat(
  text: string,
  phone: string = WHATSAPP_NUMBER,
): void {
  const encoded = encodeURIComponent(text);
  const nativeUrl = `whatsapp://send?phone=${phone}&text=${encoded}`;
  const webUrl = `https://web.whatsapp.com/send?phone=${phone}&text=${encoded}`;
  const isMobile = /Android|iPhone|iPad|iPod|webOS|BlackBerry/i.test(
    navigator.userAgent,
  );

  if (isMobile) {
    window.location.href = nativeUrl;
    return;
  }

  let handedOff = false;
  const onBlur = () => {
    handedOff = true;
    window.removeEventListener('blur', onBlur);
  };
  window.addEventListener('blur', onBlur);

  const anchor = document.createElement('a');
  anchor.href = nativeUrl;
  anchor.rel = 'noopener noreferrer';
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  window.setTimeout(() => {
    window.removeEventListener('blur', onBlur);
    if (!handedOff && document.hasFocus()) {
      window.open(webUrl, '_blank', 'noopener,noreferrer');
    }
  }, 700);
}
