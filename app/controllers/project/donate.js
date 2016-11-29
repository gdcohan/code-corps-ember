import Ember from 'ember';

const {
  Controller,
  computed: { alias, bool, not },
  get,
  inject: { service },
  set,
  RSVP
} = Ember;

export default Controller.extend({
  amount: null,
  isAddingCard: false,
  queryParams: ['amount'],

  currentUser: service(),
  store: service(),
  stripe: service(),

  project: alias('model'),
  user: alias('currentUser.user'),

  stripeCustomerCreated: bool('currentUser.user.stripePlatformCustomer.id'),
  shouldCreateCustomer: not('stripeCustomerCreated'),

  actions: {
    saveAndDonate(amount, cardParams) {
      this._clearErrors();
      this._updateIsLoading(true);

      return this._createCreditCardToken(cardParams)
                 .then((stripeResponse) => this._createCardForPlatformCustomer(stripeResponse))
                 .then((stripeCard) => this._createSubscription(amount, stripeCard))
                 .then(() => this._transitionToThankYou())
                 .catch((reason) => this._handleError(reason))
                 .finally(() => this._updateIsLoading(false));
    },

    donate(amount, stripeCard) {
      this._clearErrors();
      this._updateIsLoading(true);

      return this._createSubscription(amount, stripeCard)
                 .then(() => this._transitionToThankYou())
                 .catch((reason) => this._handleError(reason))
                 .finally(() => this._updateIsLoading(false));
    }
  },

  _createCreditCardToken(cardParams) {
    let stripeCard = this._tokenParams(cardParams);
    let stripe = get(this, 'stripe');

    return stripe.card.createToken(stripeCard);
  },

  _createCardForPlatformCustomer({ id }) {
    return this._ensureStripePlatformCustomer()
               .then(() => this._createStripePlatformCard(id));
  },

  _ensureStripePlatformCustomer() {
    if (get(this, 'shouldCreateCustomer')) {
      return this._createStripePlatformCustomer();
    } else {
      return RSVP.resolve();
    }
  },

  _createStripePlatformCustomer() {
    let { user, store } = this.getProperties('user', 'store');
    let email = get(user, 'email');

    return store.createRecord('stripe-platform-customer', { email, user })
                .save();
  },

  _createStripePlatformCard(stripeToken) {
    let store = get(this, 'store');
    let user = get(this, 'user');
    let card = store.createRecord('stripe-platform-card', { stripeToken, user });
    return card.save();
  },

  _createSubscription(quantity) {
    let projectId = get(this, 'project.id');
    let user = get(this, 'user');
    let store = get(this, 'store');

    let subscription = store.createRecord('stripe-connect-subscription', { quantity, user });
    let adapterOptions = { projectId };

    return subscription.save({ adapterOptions });
  },

  _transitionToThankYou() {
    let project = get(this, 'project');
    return this.transitionToRoute('project.thank-you', project);
  },

  _handleError(error) {
    this.set('error', error);
  },

  _tokenParams(cardParams) {
    return {
      number: cardParams.cardNumber,
      cvc: cardParams.cvc,
      exp_month: cardParams.month,
      exp_year: cardParams.year
    };
  },

  _updateIsLoading(value) {
    set(this, 'isLoading', value);
  },

  _clearErrors() {
    this.set('error', null);
  }
});
