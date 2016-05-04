Overview
========

Reference architecture for a Flask application, secured with Okta using SAML

Configuration
=============

The configuration file for the application is located in `/etc` and is named
`APPNAME.yaml` for a given application name.

secret_key
----------

A unique secret key to secure Flask sessions

metadata_url_for
----------------

A dictionary of all SAML identity providers with the name of the identity
provider as the key and the identity providers SAML metadata URL as the
value.

idp_name
--------

The name of the preferred SAML identity provider.

acs_url_scheme
--------------

Set this to `http` or `https` depending on how you're serving up the web UI.

PREFERRED_URL_SCHEME
--------------------

Set this to `http` or `https` depending on how you're serving up the web UI.

loglevel
--------

The `level <https://docs.python.org/2/library/logging.html#levels>`_ to set for logging.

Example Configuration
---------------------

Here is an example configuration for two foreign AWS accounts

::

    --- 
      secret_key: "11111111-1111-1111-1111-111111111111"
      idp_name: oktadev
      metadata_url_for: 
        okta: "http://idp.oktadev.com/metadata"
      PREFERRED_URL_SCHEME: https
      acs_url_scheme: https
      loglevel: DEBUG


Installation
============

Create a new "app" in okta

- https://mozilla-admin.okta.com/admin/apps/active
- Add Application : https://mozilla-admin.okta.com/admin/apps/add-app
- Create New App
   - SAML 2.0
   - Create
- App Name : YourAppNameGoesHere
- Next
- Single sign on URL : https://example.security.mozilla.com/saml/sso/okta
- Audience URI (SP Entity ID) : https://example.security.mozilla.com/saml/sso/okta
- Attribute Statements (Optional)

  +-----------+-------------------+
  | Name      | Value             |
  +===========+===================+
  | FirstName | ${user.firstName} |
  +-----------+-------------------+
  | LastName  | ${user.lastName}  |
  +-----------+-------------------+
  | Email     | ${user.email}     |
  +-----------+-------------------+

- Next
- Are you a customer or partner? : I'm an Okta customer adding an internal app
   - App type : Check "This is an internal app that we have created"
   - Finish
- In the "Settings" page, copy the URL of the link titled "Identity Provider metadata"
- Paste the URL into either the /opt/puppet/hiera/ENVIRONMENT.yaml file as the `flaskoktaapp::saml_url` or into your credstash
- Assign users to the app
   - Click the "People" tab in the app screen in okta
   - Click "Assign to People"
   - Search for the user
   - Click "Assign"
   - Click "Save and go back"
   - Click "Done"

Deploy

- Deploy a CloudFormation stack using the template

If using credstash

- Uncomment the credstash puppetmodule in `/opt/puppet/Puppetfile`
- Add to the CloudFormation template an IAM role granting access to the dynamodb
- Create credstash stored secrets that are listed in `puppet/hiera/ENVIRONMENT.yaml`
- Create KMS grants so the instance can decrypt the credentials
- Enable installing puppet-credstash in the Puppetfile by uncommenting
- Enable installing credstash in the cloudformation template's cloud-config by uncommenting

If not

- Add your secrets to `/opt/puppet/hiera/ENVIRONMENT.yaml`
- Re-run puppet to configure the system with the secrets
  .. code-block::

      myenv=production
      puppet apply --modulepath /opt/puppet/modules --hiera_config /opt/puppet/hiera.yaml --environment $myenv --execute "include 'flaskoktaapp'"

- Create a DNS name pointing to the instance (optional)
- Create EIP (optional)
- Create Certs (optional)

   .. code-block::


      yum install letsencrypt
      mkdir -p /var/lib/letsencrypt/global-webroot
      echo "Alias /.well-known/acme-challenge /var/lib/letsencrypt/global-webroot/.well-known/acme-challenge" >> /etc/httpd/conf/httpd.conf
      apachectl configtest && apachectl graceful
      EMAIL=user@example.com
      DOMAINS=example.com
      letsencrypt certonly --agree-tos --email $EMAIL --renew-by-default --webroot --webroot-path /var/lib/letsencrypt/global-webroot --domains $DOMAINS
      # Testing paused here for resolution of https://bugzilla.mozilla.org/show_bug.cgi?id=1251768
