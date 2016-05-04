#!/usr/bin/env python

# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

import logging
import os
import uuid
import yaml
from flask import Response

from flask import (
    Flask,
    redirect,
    render_template,
    request,
    session,
    url_for,
    make_response,
)

# pip install flask-login
from flask.ext.login import (
    LoginManager,
    UserMixin,
    current_user,
    login_required,
    login_user,
    logout_user,
)

# pip install flask-cache
from flask.ext.cache import Cache
# pip install flask-bootstrap
from flask_bootstrap import Bootstrap
# pip install flask-wtf
from flask_wtf import Form
# pip install WTForms
from wtforms import StringField
from wtforms.validators import IPAddress
# pip install pysaml2
from saml2 import (
    BINDING_HTTP_POST,
    BINDING_HTTP_REDIRECT,
    entity,
)
from saml2.client import Saml2Client
from saml2.config import Config as Saml2Config
# pip install requests
import requests

# sudo yum install python-virtualenv gcc libffi-devel xmlsec1 xmlsec1-openssl
#     openssl-devel libyaml-devel
# sudo apt-get install libxmlsec1 libxmlsec1-openssl xmlsec1


def get_config(app_name='flaskoktaapp'):
    config = {'secret_key': str(uuid.uuid4()),
              'metadata_url_for': {'okta': 'http://idp.oktadev.com/metadata'},
              'idp_name': 'okta',
              'acs_url_scheme': 'http',
              'PREFERRED_URL_SCHEME': 'http',
              'loglevel': 'DEBUG',
              'app_name': app_name}
    CONFIG_FILENAME = "/etc/%s.yaml" % app_name
    if os.path.isfile(CONFIG_FILENAME) and os.access(CONFIG_FILENAME, os.R_OK):
        with open(CONFIG_FILENAME, 'r') as f:
            config.update(yaml.load(f))
    return config

APP_NAME = os.environ.get('APP_NAME', 'flaskoktaapp')
app = Flask(__name__)
app.config.update(get_config(app_name=APP_NAME))

logging.basicConfig(level=getattr(logging, app.config['loglevel'].upper()))

cache = Cache(app, config={'CACHE_TYPE': 'simple'})
Bootstrap(app)
app.secret_key = app.config['secret_key']
login_manager = LoginManager()
login_manager.setup_app(app)
# NOTE:
#   This is implemented as a dictionary for DEMONSTRATION PURPOSES ONLY.
#   On a production system, this information must come
#   from your system's user store.
user_store = {}


def saml_client_for(idp_name='okta'):
    '''
    Given the name of an IdP, return a configuration.
    The configuration is a hash for use by saml2.config.Config
    '''

    if idp_name not in app.config['metadata_url_for']:
        raise Exception("Settings for IDP '{}' not found".format(idp_name))
    acs_url = url_for(
        "idp_initiated",
        _external=True,
        _scheme=app.config['acs_url_scheme'])

    # NOTE:
    #   Ideally, this should fetch the metadata and pass it to
    #   PySAML2 via the "inline" metadata type.
    #   However, this method doesn't seem to work on PySAML2 v2.4.0
    #
    #   SAML metadata changes very rarely. On a production system,
    #   this data should be cached as appropriate for your production system.
    rv = requests.get(app.config['metadata_url_for'][idp_name])
    import tempfile
    tmp = tempfile.NamedTemporaryFile()
    f = open(tmp.name, 'w')
    f.write(rv.text)
    f.close()

    settings = {
        'metadata': {
            # 'inline': metadata,
            'local': [tmp.name]
        },
        'service': {
            'sp': {
                'endpoints': {
                    'assertion_consumer_service': [
                        (acs_url, BINDING_HTTP_REDIRECT),
                        (acs_url, BINDING_HTTP_POST)
                    ],
                },
                # Don't verify that the incoming requests originate from us via
                # the built-in cache for authn request ids in pysaml2
                'allow_unsolicited': True,
                # Don't sign authn requests, since signed requests only make
                # sense in a situation where you control both the SP and IdP
                'authn_requests_signed': False,
                'logout_requests_signed': True,
                'want_assertions_signed': True,
                'want_response_signed': False,
            },
        },
    }
    spConfig = Saml2Config()
    spConfig.load(settings)
    spConfig.allow_unknown_attributes = True
    saml_client = Saml2Client(config=spConfig)
    tmp.close()
    return saml_client


class User(UserMixin):

    def __init__(self, user_id):
        user = {}
        self.id = None
        self.first_name = None
        self.last_name = None
        try:
            user = user_store[user_id]
            self.id = unicode(user_id)
            self.first_name = user['first_name']
            self.last_name = user['last_name']
        except:
            pass


@login_manager.user_loader
def load_user(user_id):
    return User(user_id)


@app.route("/saml/sso/okta", methods=['POST'])
def idp_initiated():
    saml_client = saml_client_for()
    logging.debug("saml_client dir : %s" % dir(saml_client))
    logging.debug("saml_client dict: %s" % saml_client.__dict__)
    logging.debug('samlresponse : %s' % request.form['SAMLResponse'])
    authn_response = saml_client.parse_authn_request_response(
        xmlstr=request.form['SAMLResponse'],
        binding=entity.BINDING_HTTP_POST)
    logging.debug('authn_response : %s' % dir(authn_response))
    authn_response.get_identity()
    user_info = authn_response.get_subject()
    username = user_info.text

    # This is what as known as "Just In Time (JIT) provisioning".
    # What that means is that, if a user in a SAML assertion
    # isn't in the user store, we create that user first, then log them in
    if username not in user_store:
        user_store[username] = {
            'first_name': authn_response.ava['FirstName'][0],
            'last_name': authn_response.ava['LastName'][0],
        }
    user = User(username)
    session['saml_attributes'] = authn_response.ava
    login_user(user)
    url = url_for('user')
    # NOTE:
    #   On a production system, the RelayState MUST be checked
    #   to make sure it doesn't contain dangerous URLs!
    if 'RelayState' in request.form:
        url = request.form['RelayState']
    # TODO : see what validation would need to be done to this value by
    #        adding the chiclet to Okta and testing
    return redirect(url)


@app.route("/saml/login/okta")
def sp_initiated():
    saml_client = saml_client_for()
    reqid, info = saml_client.prepare_for_authenticate()

    redirect_url = None
    # Select the IdP URL to send the AuthN request to
    for key, value in info['headers']:
        if key is 'Location':
            redirect_url = value
    response = redirect(redirect_url, code=302)
    # NOTE:
    #   I realize I _technically_ don't need to set Cache-Control or Pragma:
    #     http://stackoverflow.com/a/5494469
    #   However, Section 3.2.3.2 of the SAML spec suggests they are set:
    #     http://docs.oasis-open.org/security/saml/v2.0/saml-bindings-2.0-os.pdf
    #   We set those headers here as a "belt and suspenders" approach,
    #   since enterprise environments don't always conform to RFCs
    response.headers['Cache-Control'] = 'no-cache, no-store'
    response.headers['Pragma'] = 'no-cache'
    return response


@app.route("/", methods=['GET', 'POST'])
@login_required
def main_page():
    return render_template('main_page.html')


@app.route("/example.json")
@login_required
def example_json():
    response = make_response(render_template('example.json'))
    response.mimetype = 'application/json'
    return response

@app.route("/user")
@login_required
def user():
    return render_template('user.html', session=session)


@app.errorhandler(401)
def error_unauthorized(error):
    return redirect(url_for("login"))


@app.route('/login')
def login():
    if app.config['metadata_url_for'][app.config['idp_name']] == 'http://idp.oktadev.com/metadata':
        template = 'test_login.html'
    else:
        template = 'login.html'
    return render_template(template)


@app.route("/logout")
@login_required
def logout():
    logout_user()
    return redirect(url_for("main_page"))


def main():
    port = int(os.environ.get('PORT', 5000))
    if port == 5000:
        app.debug = True
    app.run(host='0.0.0.0', port=port)


if __name__ == "__main__":
    main()
