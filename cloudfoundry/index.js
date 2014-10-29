'use strict';
var util = require('util'),
path = require('path'),
yeoman = require('yeoman-generator'),
childProcess = require('child_process'),
chalk = require('chalk'),
_s = require('underscore.string'),
scriptBase = require('../script-base');

var exec = childProcess.exec;
var spawn = childProcess.spawn;

var CloudFoundryGenerator = module.exports = function CloudFoundryGenerator() {
    yeoman.generators.Base.apply(this, arguments);
    console.log(chalk.bold('CloudFoundry configuration is starting'));
    this.env.options.appPath = this.config.get('appPath') || 'src/main/webapp';
    this.baseName = this.config.get('baseName');
    this.packageName = this.config.get('packageName');
    this.packageFolder = this.config.get('packageFolder');
    this.javaVersion = this.config.get('javaVersion');
    this.hibernateCache = this.config.get('hibernateCache');
    this.databaseType = this.config.get('databaseType');
    this.prodDatabaseType = this.config.get('prodDatabaseType');
    this.angularAppName = _s.camelize(_s.slugify(this.baseName)) + 'App';
};

util.inherits(CloudFoundryGenerator, yeoman.generators.Base);
util.inherits(CloudFoundryGenerator, scriptBase);

CloudFoundryGenerator.prototype.askForName = function askForName() {
    var done = this.async();
    if (this.prodDatabaseType != 'mysql') {
        this.log.error('Error: you can only deploy on CloudFoundry using a MySQL database, and you currently use \'' + this.prodDatabaseType + '\'');
        this.abort = true;
        return;
    }

    var prompts = [{
        name: 'cloudfoundryDeployedName',
        message: 'Name to deploy as:',
        default: this.baseName
    },
    {
        name: 'cloudfoundryMysqlServiceName',
        message: 'What is the name of your MySQL service?',
        default: 'mysql'
    },
    {
        name: 'cloudfoundryMysqlServicePlan',
        message: 'What is the name of your MySQL plan?',
        default: '100mb'
    }];

    this.prompt(prompts, function (props) {
        this.cloudfoundryDeployedName = this._.slugify(props.cloudfoundryDeployedName).split('-').join('');
        this.cloudfoundryMysqlServiceName = props.cloudfoundryMysqlServiceName;
        this.cloudfoundryMysqlServicePlan = props.cloudfoundryMysqlServicePlan;
        done();
    }.bind(this));
};

CloudFoundryGenerator.prototype.checkInstallation = function checkInstallation() {
    if(this.abort) return;
    var done = this.async();

    exec('cf --version', function (err) {
        if (err) {
            this.log.error('cloudfoundry\'s cf command line interface is not available. ' +
            'You can install it via https://github.com/cloudfoundry/cli/releases');
            this.abort = true;
        }
        done();
    }.bind(this));
};

CloudFoundryGenerator.prototype.dirInit = function dirInit() {
    if(this.abort) return;
    var done = this.async();

    this.log(chalk.bold('Initializing deployment repo'));
    this.mkdir('deploy/cloudfoundry');
    done();
};

CloudFoundryGenerator.prototype.cloudfoundryAppShow = function cloudfoundryAppShow() {
    if(this.abort || typeof this.dist_repo_url !== 'undefined') return;
    var done = this.async();

    this.log(chalk.bold("\nChecking for an existing Cloud Foundry hosting environment..."));
    var child = exec('cf app '+this.cloudfoundryDeployedName+' ', { cwd: 'deploy/cloudfoundry' }, function (err, stdout, stderr) {
        var lines = stdout.split('\n');
        var dist_repo = '';
        // Unauthenticated
        if (stdout.search('cf login') >= 0) {
            this.log.error('Error: Not authenticated. Run \'cf login\' to login to your cloudfoundry account and try again.');
            this.abort = true;
        }
        done();
    }.bind(this));
};

CloudFoundryGenerator.prototype.cloudfoundryAppCreate = function cloudfoundryAppCreate() {
    if(this.abort || typeof this.dist_repo_url !== 'undefined') return;
    var done = this.async();

    this.log(chalk.bold("\nCreating your Cloud Foundry hosting environment, this may take a couple minutes..."));
    this.log(chalk.bold("Creating the database"));
    this.log('cf create-service ' + this.cloudfoundryMysqlServiceName + ' ' + this.cloudfoundryMysqlServicePlan + ' jhipster ');
    var child = exec('cf create-service ' + this.cloudfoundryMysqlServiceName + ' ' + this.cloudfoundryMysqlServicePlan + ' jhipster ', { cwd: 'deploy/cloudfoundry' }, function (err, stdout, stderr) {
        done();
    }.bind(this));

    child.stdout.on('data', function(data) {
        this.log(data.toString());
    }.bind(this));
};

CloudFoundryGenerator.prototype.productionBuild = function productionBuild() {
    if(this.abort || !this.cloudfoundry_remote_exists ) return;
    var done = this.async();

    this.log(chalk.bold('\nBuilding deploy/cloudfoundry folder, please wait...'));
    var child = exec('grunt buildcloudfoundry', function (err, stdout) {
        if (err) {
            this.log.error(err);
        }
        done();
    }.bind(this));

    child.stdout.on('data', function(data) {
        this.log(data.toString());
    }.bind(this));
};

CloudFoundryGenerator.prototype.restartApp = function restartApp() {
    if(this.abort || !this.cloudfoundry_remote_exists ) return;
    this.log(chalk.bold("\nRestarting your cloudfoundry app.\n"));

    var child = exec('cf restart ' + this.cloudfoundryDeployedName, function(err, stdout, stderr) {
        this.log(chalk.green('\nYour app should now be live'));
        if(hasWarning) {
            this.log(chalk.green('\nYou may need to address the issues mentioned above and restart the server for the app to work correctly \n\t' +
            'rhc app-restart -a ' + this.cloudfoundryDeployedName));
        }
        this.log(chalk.yellow('After application modification, re-deploy it with\n\t' + chalk.bold('grunt deploycloudfoundry')));
    }.bind(this));
};