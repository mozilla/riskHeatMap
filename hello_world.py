import os
import config
import auth
import logging

from flask import (
    Flask,
    redirect,
    render_template,
    request,
    session,
    url_for,
    make_response,
    send_from_directory,
    jsonify
)

#pip install flask-bootstrap
from flask_bootstrap import Bootstrap


#oidc
from flask_pyoidc.flask_pyoidc import OIDCAuthentication

#setup the app 
app = Flask(__name__)
#app.config.from_pyfile('env.example')
Bootstrap(app)


#logging
logger = logging.getLogger(__name__)
if os.environ.get('LOGGING') == 'True':
    logging.basicConfig(level=logging.INFO)


#config
logger.info("Choosing config")
if os.environ.get('ENVIRONMENT') == 'Production':
    # Only cloudwatch log when app is in production mode.
    #handler = watchtower.CloudWatchLogHandler()
    handler = logging.StreamHandler()
    logger.info("Using production config")
    app.logger.addHandler(handler)
    app.config.from_object(config.ProductionConfig())
else:
    # Only log flask debug in development mode.
    logger.info("Using development config")
    handler = logging.StreamHandler()
    logging.getLogger("werkzeug").addHandler(handler)
    app.config.from_object(config.DevelopmentConfig())

    
#auth = OIDCAuthentication(app,client_registration_info=client_info)
oidc_config = config.OIDCConfig()

authentication = auth.OpenIDConnect(
    oidc_config
)

oidc = authentication.auth(app)


@app.route('/logout')
def logout():
    return

@app.route('/info')
@oidc.oidc_auth
def info():
    """Return the JSONified user session for debugging."""
    return jsonify(
        id_token=session['id_token'],
        access_token=session['access_token'],
        userinfo=session['userinfo']
)

@app.route('/')
def main_page():
    return render_template("main_page.html")

@app.route("/heatmap/<path:filename>")
@oidc.oidc_auth
def heatmap_file(filename):
    return send_from_directory('heatmap/',
                               filename)
       
# We only need this for local development.
if __name__ == '__main__':
    app.run()
