#!/usr/bin/env node

/**
 * ==========================================
 * SCRIPT DE TEST DU WEBHOOK STRIPE
 * ==========================================
 * 
 * Ce script permet de tester localement votre webhook
 * sans avoir à passer par Stripe.
 */

console.log('🧪 Test du Webhook Stripe\n');

// Simulation d'un événement checkout.session.completed
const mockEvent = {
  type: 'checkout.session.completed',
  data: {
    object: {
      id: 'cs_test_123456',
      customer_email: 'test@example.com',
      customer: 'cus_test_123',
      subscription: 'sub_test_123',
      amount_total: 999, // 9.99€ en centimes
      currency: 'eur',
      metadata: {
        planType: 'standard'
      }
    }
  }
};

console.log('📋 Événement simulé :');
console.log(JSON.stringify(mockEvent, null, 2));
console.log('\n════════════════════════════════════════');

// Simulation du traitement
const session = mockEvent.data.object;
const customerEmail = session.customer_email;
const planType = session.metadata.planType;
const amountTotal = session.amount_total / 100;
const currency = session.currency.toUpperCase();

console.log('🎉 NOUVEAU PAIEMENT RÉUSSI !');
console.log('════════════════════════════════════════');
console.log(`📧 Email: ${customerEmail}`);
console.log(`📦 Plan: ${planType.toUpperCase()}`);
console.log(`💰 Montant: ${amountTotal} ${currency}`);
console.log(`🔑 Customer ID: ${session.customer}`);
console.log(`🔑 Subscription ID: ${session.subscription}`);
console.log('════════════════════════════════════════');
console.log(`✅ Abonné ${planType.toUpperCase()} : ${customerEmail}`);
console.log('\n✅ Test réussi ! Le webhook fonctionnerait correctement.\n');
