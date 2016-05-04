# # Class: flaskoktaapp
#
# Installs and configures an Okta authenticated Flask application with Apache mod_wsgi.
#
# ## Parameters
#
# See params.pp
class flaskoktaapp (
  $flask_secret_key = $flaskoktaapp::params::flask_secret_key,
  $idp_name = $flaskoktaapp::params::idp_name,
  $install_dir = $flaskoktaapp::params::install_dir,
  $saml_url = $flaskoktaapp::params::saml_url,
  $tls_cert_filename = $flaskoktaapp::params::tls_cert_filename,
  $tls_certificate = $flaskoktaapp::params::tls_certificate,
  $tls_certificate_key = $flaskoktaapp::params::tls_certificate_key,
  $tls_key_filename = $flaskoktaapp::params::tls_key_filename,
  $username = $flaskoktaapp::params::username,
  $virtualenv_dir = $flaskoktaapp::params::virtualenv_dir,
  $wsgi_filename = $flaskoktaapp::params::wsgi_filename,
  $domain_name = $flaskoktaapp::params::domain_name,
  $app_name = $flaskoktaapp::params::app_name,
) inherits flaskoktaapp::params {

  include 'epel' # Workaround for bug https://github.com/stankevich/puppet-python/issues/196
  include 'python'
  include 'apache'
  include 'apache::mod::ssl'
  include 'apache::mod::wsgi'

  $docroot = "${install_dir}/docroot"

  file { [ $install_dir, $docroot ]:
      ensure => 'directory',
  }

  user { $username:
    comment => 'Flask Service User',
    shell   => '/sbin/nologin',
  }

  python::virtualenv { $virtualenv_dir :
    require => File[$install_dir],
  }

  package { ['gcc',
    'libffi-devel',
    'xmlsec1',
    'xmlsec1-openssl',
    'openssl-devel',
    'libyaml-devel']: }

  python::pip { 'flaskoktaapp' :
    virtualenv    => $virtualenv_dir,
    ensure        => '1.0.0',
    url           => 'file:///opt/src',
    notify        => Class['apache::service'],
  }

  file { $wsgi_filename:
    content => template('flaskoktaapp/flaskoktaapp.wsgi.erb'),
    notify  => Class['apache::service'],
  }

  file { "/etc/${app_name}.yaml":
    content => template('flaskoktaapp/flaskoktaapp.yaml.erb'),
    notify  => Class['apache::service'],
  }

  file { $tls_key_filename:
    content => $tls_certificate_key,
    mode    => '0600',
    notify  => Class['apache::service'],
  }

  file { $tls_cert_filename:
    content => $tls_certificate,
    notify  => Class['apache::service'],
  }

  apache::vhost { $domain_name:
    wsgi_script_aliases => {
      '/' => $wsgi_filename
    },
    wsgi_daemon_process => $username,
    wsgi_process_group  => $username,
    docroot             => $docroot,
    port                => '443',
    ssl                 => true,
    ssl_cert            => $tls_cert_filename,
    ssl_key             => $tls_key_filename,
    require             => [
      File[$tls_cert_filename],
      File[$tls_key_filename],
      User[$username],
      File[$wsgi_filename],
      File[$docroot],
    ]
  }
}
