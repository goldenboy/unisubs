// Universal Subtitles, universalsubtitles.org
// 
// Copyright (C) 2010 Participatory Culture Foundation
// 
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as
// published by the Free Software Foundation, either version 3 of the
// License, or (at your option) any later version.
// 
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
// 
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see 
// http://www.gnu.org/licenses/agpl-3.0.html.

goog.provide('unisubs.translate.Dialog');

/**
 * @constructor
 * 
 */
unisubs.translate.Dialog = function(opener, 
                                     serverModel,
                                     videoSource, 
                                     subtitleState, 
                                     standardSubState) {
    unisubs.Dialog.call(this, videoSource);
    unisubs.SubTracker.getInstance().start(true);
    this.opener_ = opener;
    this.subtitleState_ = subtitleState;
    this.standardSubState_ = standardSubState;

    this.serverModel_ = serverModel;
    this.serverModel_.init();
    this.saved_ = false;
    this.rightPanelListener_ = new goog.events.EventHandler(this);
};
goog.inherits(unisubs.translate.Dialog, unisubs.subtitle.Dialog);

unisubs.translate.Dialog.State_ = {
    TRANSLATE: 0,
    EDIT_METADATA: 1,
    
};

unisubs.translate.Dialog.prototype.createDom = function() {
    unisubs.translate.Dialog.superClass_.createDom.call(this);
    this.setDraggable(false);
    this.translationPanel_ = new unisubs.translate.TranslationPanel(
        this.serverModel_.getCaptionSet(), this.standardSubState_, this);
    this.getCaptioningAreaInternal().addChild(
        this.translationPanel_, true);
    var rightPanel = this.createRightPanel_();
    this.setRightPanelInternal(rightPanel);
    this.getHandler().
        listen(
            rightPanel, unisubs.RightPanel.EventType.DONE,
            this.handleDoneKeyPress_).
        listen(
            rightPanel, unisubs.RightPanel.EventType.SAVEANDEXIT,
            this.handleSaveAndExitKeyPress_);
    goog.dom.classes.add(this.getContentElement(),
                         'unisubs-modal-widget-translate');
    this.showGuidelines_();
    this.enterState_(unisubs.translate.Dialog.State_.TRANSLATE);
};
unisubs.translate.Dialog.prototype.showGuidelines_ = function() {
    if (!unisubs.guidelines['translate']) {
        return;
    }

    var guidelinesPanel = new unisubs.GuidelinesPanel(unisubs.guidelines['translate']);
    this.showTemporaryPanel(guidelinesPanel);
    this.displayingGuidelines_ = true;

    var that = this;
    this.getHandler().listenOnce(guidelinesPanel, unisubs.GuidelinesPanel.CONTINUE, function(e) {
        goog.Timer.callOnce(function() {
            that.displayingGuidelines_ = false;
            that.hideTemporaryPanel();
        });
    });
};
unisubs.translate.Dialog.prototype.createRightPanel_ = function() {
    var title = this.subtitleState_.VERSION > 0 ? 
        "Editing Translation" : "Adding a New Translation";
    var helpContents = new unisubs.RightPanel.HelpContents(
        title,
        [["Thanks for volunteering to translate! Your translation will be available to ",
"everyone  watching the video in our widget."].join(''),
         ["Please translate each line, one by one, in the white  ", 
          "space below each line."].join(''),
         ["If you need to rearrange the order of words or split a phrase ",
          "differently, that's okay."].join(''),
         ["As you're translating, you can use the \"TAB\" key to advance to ",
          "the next line, and \"Shift-TAB\" to go back."].join('')
        ], 2, 0);
    var extraHelp = [
        ["Google Translate", "http://translate.google.com/"],
        ["List of dictionaries", "http://yourdictionary.com/languages.html"],
        ["Firefox spellcheck dictionaries", 
         "https://addons.mozilla.org/en-US/firefox/browse/type:3"]
    ];
    return new unisubs.translate.TranslationRightPanel(
        this,
        this.serverModel_, helpContents, extraHelp, [], false, "Done?", 
        "Submit final translation", "Resources for Translators");
};
unisubs.translate.Dialog.prototype.handleSaveAndExitKeyPress_ = function(e) {
    e.preventDefault();
    this.saveWork(true);
};
unisubs.translate.Dialog.prototype.handleDoneKeyPress_ = function(event) {
    event.preventDefault();
    if (this.state_ == unisubs.subtitle.Dialog.State_.EDIT_METADATA)
        this.saveWork(true);
    else
        this.enterState_(this.nextState_());
};

unisubs.translate.Dialog.prototype.isWorkSaved = function() {
    return this.saved_ || !this.serverModel_.anySubtitlingWorkDone();
};
unisubs.translate.Dialog.prototype.enterDocument = function() {
    //unisubs.translate.Dialog.superClass_.enterDocument.call(this);
    unisubs.Dialog.translationDialogOpen = true;
    var that = this;
    this.getRightPanelInternal().showDownloadLink(
        function() {
            return that.makeJsonSubs();
        });
};
unisubs.translate.Dialog.prototype.saveWorkInternal = function(closeAfterSave) {
    var that = this;
    this.getRightPanelInternal().showLoading(true);
    this.serverModel_.finish(
        function(serverMsg){
            unisubs.subtitle.OnSavedDialog.show(serverMsg, function(){
                that.onWorkSaved(closeAfterSave);
            })
        },
        function(opt_status) {
            if (that.finishFailDialog_)
                that.finishFailDialog_.failedAgain(opt_status);
            else
                that.finishFailDialog_ = unisubs.finishfaildialog.Dialog.show(
                    that.serverModel_.getCaptionSet(), opt_status,
                    goog.bind(that.saveWorkInternal, that, closeAfterSave));
        });
};
unisubs.translate.Dialog.prototype.showGuidelinesForState_ = function(state) {
    this.setState_(state);
}

unisubs.Dialog.prototype.setVisible = function(visible) {
    if (visible) {
        unisubs.Dialog.superClass_.setVisible.call(this, true);
        goog.dom.getDocumentScrollElement().scrollTop = 0;
    }
    else {
        if (this.isWorkSaved()) {
            this.hideDialogImpl_();
        }
        else {
            this.showSaveWorkDialog_();
        }
    }
};

unisubs.translate.Dialog.prototype.onWorkSaved = function() {
    if (this.finishFailDialog_) {
        this.finishFailDialog_.setVisible(false);
        this.finishFailDialog_ = null;
    }
    unisubs.widget.ResumeEditingRecord.clear();
    this.getRightPanelInternal().showLoading(false);
    this.saved_ = true;
    this.setVisible(false);
}

unisubs.translate.Dialog.prototype.disposeInternal = function() {
    unisubs.translate.Dialog.superClass_.disposeInternal.call(this);
    this.serverModel_.dispose();
};

unisubs.translate.Dialog.prototype.enterState_ = function(state) {
    this.showGuidelinesForState_(state);
};

unisubs.translate.Dialog.prototype.suspendKeyEvents_ = function(suspended) {
    this.keyEventsSuspended_ = suspended;
    if (this.currentSubtitlePanel_ && this.currentSubtitlePanel_.suspendKeyEvents)
        this.currentSubtitlePanel_.suspendKeyEvents(suspended);
};

unisubs.translate.Dialog.prototype.setState_ = function(state) {
    this.state_ = state;

    this.suspendKeyEvents_(false);

    var s = unisubs.subtitle.Dialog.State_;

    this.setExtraClass_();

    var nextSubPanel = this.makeCurrentStateSubtitlePanel_();
    var captionPanel = this.getCaptioningAreaInternal();
    captionPanel.removeChildren(true);
    captionPanel.addChild(nextSubPanel, true);

    var rightPanel = nextSubPanel.getRightPanel();
    this.setRightPanelInternal(rightPanel);

    this.getTimelinePanelInternal().removeChildren(true);

    this.disposeCurrentPanels_();
    this.currentSubtitlePanel_ = nextSubPanel;

    var et = unisubs.RightPanel.EventType;
    this.rightPanelListener_.
        listen(
            rightPanel, et.LEGENDKEY, this.handleLegendKeyPress_).
        listen(
            rightPanel, et.DONE, this.handleDoneKeyPress_).
        listen(
            rightPanel, et.SAVEANDEXIT, this.handleSaveAndExitKeyPress_).
        listen(
            rightPanel, et.GOTOSTEP, this.handleGoToStep_);
    var backButtonText = null;
    if (state == s.EDIT_METADATA ){
        backButtonText = "Back to Translation";
    }
    if (backButtonText){
        rightPanel.showBackLink(backButtonText);
        this.rightPanelListener_.listen(
            rightPanel, et.BACK, this.handleBackKeyPress_);

    }

    var videoPlayer = this.getVideoPlayerInternal();
    if (this.isInDocument()) {
        videoPlayer.pause();
        videoPlayer.setPlayheadTime(0);
    }
};
unisubs.translate.Dialog.prototype.makeCurrentStateSubtitlePanel_ = function() {
    var s = unisubs.translate.Dialog.State_;
    if (this.state_ == s.TRANSLATE)
        return new unisubs.translate.TranslationPanel(
        this.serverModel_.getCaptionSet(), this.standardSubState_, this);
    else if (this.state_ == s.EDIT_METADATA)
        return new unisubs.editmetadata.Panel(
            this.serverModel_.getCaptionSet(),
            this.getVideoPlayerInternal(),
            this.serverModel_,
            this.captionManager_,
            this.standardSubState_ ,
            false
        );
};

/**
 * Tries translate subtitles with BingTranslator
 */
unisubs.translate.Dialog.prototype.translateViaBing = function(){
    //I don't know how better call this. I think it should be incapsulated in translationList_,
    //but have chain of function calls can confuse.
    this.translationPanel_.getTranslationList().translateViaBing(
        this.standardSubState_.LANGUAGE, this.subtitleState_.LANGUAGE);
};

unisubs.translate.Dialog.prototype.getStandardLanguage = function(){
    return this.standardSubState_.LANGUAGE;
};

unisubs.translate.Dialog.prototype.getSubtitleLanguage = function(){
    return this.subtitleState_.LANGUAGE;
};

unisubs.translate.Dialog.prototype.getServerModel = function(){
    return this.serverModel_;
}

unisubs.translate.Dialog.prototype.makeJsonSubs =  function (){
    return this.serverModel_.getCaptionSet().makeJsonSubs();
};

unisubs.translate.Dialog.prototype.forkAndClose = function() {
    var dialog = new unisubs.translate.ForkDialog(
        goog.bind(this.forkImpl_, this));
    dialog.setVisible(true);
};

unisubs.translate.Dialog.prototype.forkImpl_ = function() {
    this.subtitleState_.fork();
    this.serverModel_.fork(this.standardSubState_);
    this.hideToFork();
    this.opener_.openSubtitlingDialog(
        this.serverModel_,
        this.subtitleState_);
};
