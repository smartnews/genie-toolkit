// -*- mode: js; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// This file is part of Genie
//
// Copyright 2019 The Board of Trustees of the Leland Stanford Junior University
//
// Author: Silei Xu <silei@cs.stanford.edu>
//
// See COPYING for details
"use strict";

const fs = require('fs');
const assert = require('assert');
const util = require('util');
const ThingTalk = require('thingtalk');

const { parseConstantFile } = require('./lib/constant-file');
const CanonicalGenerator = require('./lib/webqa-canonical-generator');
const StreamUtils = require('../lib/stream-utils');

async function loadClassDef(thingpedia) {
    const library = ThingTalk.Grammar.parse(await util.promisify(fs.readFile)(thingpedia, { encoding: 'utf8' }));
    assert(library.isLibrary && library.classes.length === 1 && library.classes[0].kind.startsWith('org.schema'));
    return library.classes[0];
}

module.exports = {
    initArgparse(subparsers) {
        const parser = subparsers.addParser('webqa-update-canonicals', {
            addHelp: true,
            description: "Use BERT to expand canonicals"
        });
        parser.addArgument(['-o', '--output'], {
            required: true,
            type: fs.createWriteStream
        });
        parser.addArgument(['-l', '--locale'], {
            defaultValue: 'en-US',
            help: `BGP 47 locale tag of the natural language being processed (defaults to en-US).`
        });
        parser.addArgument('--constants', {
            required: true,
            help: 'TSV file containing constant values to use.'
        });
        parser.addArgument('--thingpedia', {
            required: true,
            help: 'Path to ThingTalk file containing class definitions.'
        });
        parser.addArgument('--queries', {
            required: true,
            help: `List of query functions to include, split by comma (no space).`
        });

    },

    async execute(args) {
        const constants = await parseConstantFile(args.locale, args.constants);
        const classDef = await loadClassDef(args.thingpedia);
        const queries = args.queries.split(',').map((qname) => qname.charAt(0).toUpperCase() + qname.slice(1));
        const generator = new CanonicalGenerator(classDef, constants, queries);

        const updatedClassDef = await generator.generate();

        args.output.end(updatedClassDef.prettyprint());
        StreamUtils.waitFinish(args.output);
    }
};
