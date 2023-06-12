import os
import requests

from functools import wraps
from flask import Flask, render_template, request, Response, redirect, url_for, session


def create_app(test_config=None):
    # create and configure the app
    app = Flask(__name__, instance_relative_config=True)
    app.static_folder = 'static'
    app.config['SECRET_KEY'] = 'dev'

    # ensure the instance folder exists
    try:
        os.makedirs(app.instance_path)
    except OSError:
        pass

    # a simple page that says hello
    @app.route('/')
    def hello():
        return render_template("index.html", active="data")

    # a simple page that says hello
    @app.route('/login', methods=('GET', 'POST'))
    def login():
        if request.method == 'GET':
            return render_template('login.html')

        if request.method == 'POST':
            req = request.get_json()
            username, password = req['username'], req['password']

            api_key = "AIzaSyBOZzyu09N3Ye9uVxEs3AxVYjYC8pRjTbs"
            url = "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=" + api_key
            body = {
                "email": username,
                "password": password,
                "returnSecureToken": True
            }

            post_response = requests.post(url, json=body)
            post_response_json = post_response.json()

            if 'error' not in post_response_json.keys():
                session.clear()
                session["user"] = {"Username": username}
                return Response(status=200)
            else:
                return Response(status=403)

    # a simple page that says hello
    @app.route('/about')
    def about():
        return render_template("about.html", active="about")

    def login_required(view):
        @wraps(view)
        def wrapped_view(**kwargs):
            if 'user' not in session.keys():
                return redirect(url_for('login'))

            return view(**kwargs)

        return wrapped_view

    # a simple page that says hello
    @app.route('/profile')
    @login_required
    def user():
        return render_template("user.html")

    @app.route('/logout')
    def logout():
        session.clear()
        return redirect(url_for('login'))

    return app