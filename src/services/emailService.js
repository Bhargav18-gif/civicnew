import emailjs from '@emailjs/browser';

/**
 * Event-Driven Email Delivery Service
 * Transactional notifications are primarily handled server-side.
 * Browser-side EmailJS is an optional cosmetic enhancement and will
 * never break complaint ingestion or workflow state.
 */
class EmailService {
  constructor() {
    this.serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID;
    this.templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
    this.publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

    if (this.isConfigured()) {
      try {
        emailjs.init({ publicKey: this.publicKey });
      } catch (err) {
        console.info('[EMAIL SERVICE] EmailJS init note:', err.message);
      }
    }
  }

  isConfigured() {
    return Boolean(this.serviceId && this.templateId && this.publicKey);
  }

  /**
   * Sends a complaint confirmation email if configured.
   * Fails gracefully without impeding the citizen workflow.
   */
  async sendComplaintConfirmation(data, retries = 1) {
    if (!this.isConfigured()) {
      return false;
    }

    try {
      const response = await emailjs.send(
        this.serviceId,
        this.templateId,
        data
      );
      return response.status === 200;
    } catch (err) {
      console.warn('[EMAIL SERVICE] Email delivery notice:', err?.message || err);
      if (retries > 0) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        return this.sendComplaintConfirmation(data, retries - 1);
      }
      return false;
    }
  }
}

export const emailService = new EmailService();
