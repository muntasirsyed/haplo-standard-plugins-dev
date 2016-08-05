/* Haplo Platform                                     http://haplo.org
 * (c) Haplo Services Ltd 2006 - 2016    http://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


_.extend(P.Workflow.prototype, {

    objectElementActionPanelName: function(name) {
        var workflow = this;
        workflow.plugin.implementService("std:action_panel:"+name, function(display, builder) {
            var M = workflow.instanceForRef(display.object.ref);
            if(M) {
                M.fillActionPanel(builder);
            }
        });
        return this;
    },

    panelHeading: function(priority, title) {
        var prototype = this.$instanceClass.prototype;
        if(!prototype.$panelHeadings) { prototype.$panelHeadings = []; }
        prototype.$panelHeadings.push({priority:priority, title:title});
    }

});

// --------------------------------------------------------------------------

_.extend(P.WorkflowInstanceBase.prototype.$fallbackImplementations, {

    // QUICK IMPERSONATE PROOF OF CONCEPT
    // abuse workUnit renderer to inject the information/javascript we need
    $renderWork: {selector:{}, handler:function(M, W) {
        var uid, currentlyWith = M.workUnit.actionableBy;
        // if actionable user is a group, get the first member of that group's user id
        if(currentlyWith.isGroup) { 
            var members = currentlyWith.loadAllMembers();
            if(members.length) { uid = members[0].id; }
        } else { uid = currentlyWith.id; }
        W.render({
            workUnit: M.workUnit,
            processName: M.getWorkflowProcessName(),
            status: M._getText(['status'], [M.state]),
            timeline: M.renderTimelineDeferred(),
            currentlyWithUid: O.currentUser.id !== uid ? uid : undefined
        }, P.template("default-work"));
        return true;
    }},

    $renderWorkList: {selector:{}, handler:function(M, W) {
        var view = {status:M._getText(['status-list', 'status'], [M.state])};
        M.setWorkListFullInfoInView(W, view);
        if(M.workUnit.ref) {
            view.object = M.workUnit.ref.load();
        } else {
            view.taskTitle = M._call('$taskTitle');
        }
        W.render(view, P.template("default-work-list"));
        return true;
    }},

    $workListFullInfo: {selector:{}, handler:function(M, W, view) {
        if(!view.fullInfo) {
            view.fullInfo = M._call('$taskUrl');
        }
        return true;
    }},

    $actionPanelStatusUI: {selector:{}, handler:function(M, builder) {
        builder.status("top", this._getText(['status'], [this.state]));
        if(!this.workUnit.closed) {
            var user = this.workUnit.actionableBy;
            if(user && user.name) {
                builder.element("top", {
                    title: this._getTextMaybe(['status-ui-currently-with'], [this.state]) || 'Currently with',
                    label: user.name
                });
            }
        }
    }},

    $actionPanelTransitionUI: {selector:{}, handler:function(M, builder) {
        if(M.workUnit.isActionableBy(O.currentUser) && !M.transitions.empty) {
            builder.link("default",
                "/do/workflow/transition/"+M.workUnit.id,
                M._getText(['action-label'], [M.state]),
                "primary"
            );
        }
    }}

});

// --------------------------------------------------------------------------

_.extend(P.WorkflowInstanceBase.prototype, {

    // extraParameters may include "target" key to specify next target
    transitionUrl: function(transition, extraParameters) {
        // Use HSVT for safe generation of URL
        return P.template("transition-url").render({
            id: this.workUnit.id,
            transition: transition,
            extraParameters: extraParameters
        });
    },

    getWorkflowProcessName: function() {
        return this._getTextMaybe(["workflow-process-name"], [this.state]) || 'Workflow';
    },

    fillActionPanel: function(builder) {
        this._callHandler('$actionPanelStatusUI', builder);
        this._callHandler('$actionPanelTransitionUI', builder);
        this._callHandler('$actionPanel', builder);
        this._addAdminActionPanelElements(builder);
        // Add any configured headings to the panels in the action panel, if they have something in them
        var headings = this.$panelHeadings;
        if(headings) {
            headings.forEach(function(heading) {
                var panel = builder.panel(heading.priority);
                if(!panel.empty) { panel.element(0, {title:heading.title}); }
            });
        }
        return builder;
    },

    setWorkListFullInfoInView: function(W, view) {
        this._callHandler('$workListFullInfo', W, view);
    },

    renderTimelineDeferred: function() {
        var entries = [];
        var timeline = this.timelineSelect();
        var layout = P.template('timeline/entry-layout');
        for(var i = 0; i < timeline.length; ++i) {
            var entry = timeline[i];
            var textSearch = [entry.action];
            if(entry.previousState) { textSearch.push(entry.previousState); }
            var special, text = this._getTextMaybe(['timeline-entry'], textSearch);
            // If this can't be fulfilled by the text system, try the render handler instead
            if(!text) {
                special = this._call('$renderTimelineEntryDeferred', entry) ||
                    this._renderTimelineEntryDeferredBuiltIn(entry);
            }
            if(text || special) {
                entries.push(layout.deferredRender({
                    entry: entry,
                    text: text,
                    special: special
                }));
            }
        }
        return P.template("timeline").deferredRender({entries:entries});
    },

    // Render built-in timeline entries
    // This is a separate function which is hardcoded into the timeline rendering so it's
    // not easy to accidently remove, eg something else updates fallbackImplementation.
    _renderTimelineEntryDeferredBuiltIn: function(entry) {
        switch(entry.action) {
            // Can be overridden with timeline-entry:<NAME> text or renderTimelineEntryDeferred handler
            case "AUTOMOVE":
                return P.template("timeline/automove").deferredRender({});
            case "HIDE":
                return P.template("timeline/hide").deferredRender({entry:entry,hide:true});
            case "UNHIDE":
                return P.template("timeline/hide").deferredRender({entry:entry,hide:false});
        }
    },

    _workUnitRender: function(W) {
        this._callHandler(
            (W.context === "list") ? '$renderWorkList' : '$renderWork',
            W
        );
    },

    _workUnitNotify: function(workUnit) {
        var notify = new NotificationView();
        if(false === this._callHandler('$notification', notify)) {
            return null; // notification cancelled
        }
        return notify._finalise(this);
    }
});

// --------------------------------------------------------------------------

var NotificationView = function() {
    this.$notesHTML = [];
    this.$endHTML = [];
};
NotificationView.prototype = {
    addNoteText: function(notes) {
        this.$notesHTML.push(P.template('email/status-notes-text').render({notes:notes}));
        return this;
    },
    addNoteHTML: function(html) {
        this.$notesHTML.push(html);
        return this;
    },
    addEndHTML: function(html) {
        this.$endHTML.push(html);
        return this;
    },
    _finalise: function(M) {
        // Basic defaults have slightly different logic to platform
        if(!this.title)     { this.title = M._call('$taskTitle'); }
        if(!this.subject)   { this.subject = this.title; }
        if(!this.action)    { this.action = M._call('$taskUrl'); }
        if(!this.template)  { this.template = M.$emailTemplate; }
        if(!this.status) {
            var statusText = M._getTextMaybe(['notification-status', 'status'], [M.state]);
            if(statusText) { this.status = statusText; }
        }
        if(!this.button) {
            var buttonLabel = M._getTextMaybe(['notification-action-label', 'action-label'], [M.state]);
            if(buttonLabel) { this.button = buttonLabel; }
        }
        if(0 === this.$notesHTML.length) {
            // If there aren't any notes, use the workflow text system to find some 
            var notesText = M._getTextMaybe(['notification-notes'], [M.state]);
            if(notesText) { this.addNoteText(notesText); }
        }
        if(0 !== this.$notesHTML.length) { this.notesHTML = this.$notesHTML.join(''); }
        if(0 !== this.$endHTML.length)   { this.endHTML = this.$endHTML.join(''); }
        delete this.$notesHTML;
        delete this.$endHTML;
        return this;
    }
};

// --------------------------------------------------------------------------

P.respond("GET,POST", "/do/workflow/transition", [
    {pathElement:0, as:"workUnit", allUsers:true},  // Security check below
    {parameter:"transition", as:"string", optional:true},
    {parameter:"target", as:"string", optional:true}
], function(E, workUnit, transition, requestedTarget) {
    if(!workUnit.isActionableBy(O.currentUser)) {
        return E.render({}, "transition-not-actionable");
    }

    var workflow = P.allWorkflows[workUnit.workType];
    if(!workflow) { O.stop("Workflow not implemented"); }
    var M = workflow.instance(workUnit);

    if(M.transitions.list.length === 1) {
        // If there is only one transition available, automatically select it to avoid
        // a confusing page with only one option.
        transition = M.transitions.list[0].name;
    }

    if(transition) {
        M._setPendingTransition(transition);
    }

    try {
        var ui = new TransitionUI(M, transition, requestedTarget);

        if(transition && M.transitions.has(transition)) {

            if(E.request.method === "POST") {
                M._callHandler('$transitionFormSubmitted', E, ui);
                if(ui._preventTransition) {
                    // Feature doesn't want the transition to happen right now, maybe redirect?
                    if(ui._redirect) {
                        return E.response.redirect(ui._redirect);
                    }
                } else {
                    // Workflow must validate any targets passed in to this UI, as otherwise
                    // user can pass in anything they want and mess things up.
                    var overrideTarget;
                    if(requestedTarget) {
                        if(M._callHandler('$transitionUIValidateTarget', requestedTarget) === true) {
                            overrideTarget = requestedTarget;
                        }
                    }

                    M._callHandler('$transitionFormPreTransition', E, ui);
                    M.transition(transition, ui._getTransitionDataMaybe(), overrideTarget);
                    var redirectTo = ui._redirect || M._call('$taskUrl');
                    return E.response.redirect(redirectTo);
                }
            }

            ui.transition = transition;
            ui.transitionProperties = M.transitions.properties(transition);
            M._callHandler('$transitionUI', E, ui);

        } else {
            // Generate std:ui:choose template options from the transition
            var urlExtraParameters = requestedTarget ? {target:requestedTarget} : undefined;
            ui.options = _.map(M.transitions.list, function(transition) {
                return {
                    action: M.transitionUrl(transition.name, urlExtraParameters),
                    label: transition.label,
                    notes: transition.notes,
                    indicator: transition.indicator
                };
            });
        }

        if(ui._redirect) {
            return E.response.redirect(ui._redirect);
        }

        E.render(ui);

    } finally {
        // M.transition() may have already unset it by now
        M._setPendingTransition(undefined);
    }
});

// --------------------------------------------------------------------------

// Represents the built in UI, and act as the view for rendering.
var TransitionUI = function(M, transition, target) {
    this.M = M;
    this.requestedTransition = transition;
    this.requestedTarget = target;
};
TransitionUI.prototype = {
    backLinkText: "Cancel",
    addFormDeferred: function(position, deferred) {
        if(!this.$formDeferred) { this.$formDeferred = []; }
        this.$formDeferred.push({position:position, deferred:deferred});
    },
    preventTransition: function() {
        this._preventTransition = true;
    },
    redirect: function(path) {
        this._redirect = path;
    },
    _getFormDeferreds: function(position) {
        return _.compact(_.map(this.$formDeferred || [], function(h) {
            return (h.position === position) ? h.deferred : undefined;
        }));
    },
    _getTransitionDataMaybe: function() {
        return this._transitionData;
    }
};
TransitionUI.prototype.__defineGetter__('pageTitle', function() {
    var taskTitle = this.M._call("$taskTitle");
    var pageTitle = this.M._getText(['transition-page-title', 'action-label'], [this.M.state]);
    if(taskTitle) { pageTitle = pageTitle + ': ' + taskTitle; }
    return pageTitle;
});
TransitionUI.prototype.__defineGetter__('transitionData', function() {
    var data = this._transitionData;
    if(!data) { data = this._transitionData = {}; }
    return data;
});
TransitionUI.prototype.__defineGetter__("backLink",             function() { return this.M._call('$taskUrl'); });
TransitionUI.prototype.__defineGetter__("bottomFormDeferreds",  function() { return this._getFormDeferreds("bottom"); });
TransitionUI.prototype.__defineGetter__("topFormDeferreds",     function() { return this._getFormDeferreds("top"); });
